/**
 * Core API response processing utilities
 * Extracted from edge-function-response-processor.ts for reusability
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface ErrorDetail {
  field?: string;
  code?: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ErrorDetail[];
  warnings: ErrorDetail[];
}

/**
 * Response formatting utilities
 */
export const responseFormatters = {
  /**
   * Create success response
   */
  success<T>(
    data: T,
    message?: string,
    metadata?: Record<string, unknown>,
    duration?: number
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      message: message || 'Operation completed successfully',
      timestamp: new Date().toISOString(),
      duration,
      metadata
    };
  },

  /**
   * Create error response
   */
  error(
    error: string,
    message?: string,
    metadata?: Record<string, unknown>,
    duration?: number
  ): ApiResponse<never> {
    return {
      success: false,
      error,
      message: message || 'Operation failed',
      timestamp: new Date().toISOString(),
      duration,
      metadata
    };
  },

  /**
   * Transform any data into standard response format
   */
  standardize<T>(
    result: T | { success: boolean; data?: T; error?: string },
    operationName: string,
    startTime?: number
  ): ApiResponse<T> {
    const duration = startTime ? Date.now() - startTime : undefined;

    // If already in API response format
    if (typeof result === 'object' && result !== null && 'success' in result) {
      const existing = result as ApiResponse<T>;
      return {
        ...existing,
        timestamp: new Date().toISOString(),
        duration: duration || existing.duration,
        message: existing.message || `${operationName} completed`
      };
    }

    // Transform regular data
    return responseFormatters.success(
      result as T,
      `${operationName} completed successfully`,
      { operationName },
      duration
    );
  }
};

/**
 * Validation utilities
 */
export const validationUtils = {
  /**
   * Validate response data structure
   */
  validateStructure(data: unknown, requiredFields: string[]): ValidationResult {
    const errors: ErrorDetail[] = [];
    const warnings: ErrorDetail[] = [];

    if (!data || typeof data !== 'object') {
      errors.push({
        code: 'INVALID_DATA_TYPE',
        message: 'Response data must be an object',
        severity: 'error'
      });
      return { isValid: false, errors, warnings };
    }

    const dataObj = data as Record<string, unknown>;
    for (const field of requiredFields) {
      if (!(field in dataObj) || dataObj[field] === undefined || dataObj[field] === null) {
        errors.push({
          field,
          code: 'MISSING_REQUIRED_FIELD',
          message: `Required field '${field}' is missing or null`,
          severity: 'error'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  },

  /**
   * Validate array response
   */
  validateArray(data: unknown, itemValidator?: (item: unknown) => ValidationResult): ValidationResult {
    const errors: ErrorDetail[] = [];
    const warnings: ErrorDetail[] = [];

    if (!Array.isArray(data)) {
      errors.push({
        code: 'INVALID_ARRAY_TYPE',
        message: 'Response data must be an array',
        severity: 'error'
      });
      return { isValid: false, errors, warnings };
    }

    if (itemValidator) {
      data.forEach((item, index) => {
        const itemResult = itemValidator(item);
        if (!itemResult.isValid) {
          errors.push(...itemResult.errors.map(err => ({
            ...err,
            field: `[${index}]${err.field ? '.' + err.field : ''}`
          })));
          warnings.push(...itemResult.warnings.map(warn => ({
            ...warn,
            field: `[${index}]${warn.field ? '.' + warn.field : ''}`
          })));
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
};

/**
 * Error handling utilities
 */
export const errorUtils = {
  /**
   * Extract meaningful error message from various error types
   */
  extractErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null) {
      const obj = error as any;
      return obj.message || obj.error || obj.toString();
    }
    return 'Unknown error occurred';
  },

  /**
   * Categorize error types
   */
  categorizeError(error: unknown): {
    type: 'network' | 'validation' | 'business' | 'system' | 'unknown';
    severity: 'low' | 'medium' | 'high' | 'critical';
    retryable: boolean;
  } {
    const message = errorUtils.extractErrorMessage(error).toLowerCase();

    // Network errors
    if (message.includes('fetch') || message.includes('network') || message.includes('timeout')) {
      return { type: 'network', severity: 'medium', retryable: true };
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return { type: 'validation', severity: 'low', retryable: false };
    }

    // Business logic errors
    if (message.includes('not found') || message.includes('unauthorized') || message.includes('forbidden')) {
      return { type: 'business', severity: 'medium', retryable: false };
    }

    // System errors
    if (message.includes('internal') || message.includes('server') || message.includes('database')) {
      return { type: 'system', severity: 'high', retryable: true };
    }

    return { type: 'unknown', severity: 'medium', retryable: false };
  },

  /**
   * Create standardized error response
   */
  createErrorResponse(
    error: unknown,
    operationName: string,
    context?: Record<string, unknown>
  ): ApiResponse<never> {
    const message = errorUtils.extractErrorMessage(error);
    const category = errorUtils.categorizeError(error);

    return responseFormatters.error(
      message,
      `${operationName} failed`,
      {
        errorType: category.type,
        severity: category.severity,
        retryable: category.retryable,
        context
      }
    );
  }
};

/**
 * Retry logic utilities
 */
export const retryUtils = {
  /**
   * Calculate delay for exponential backoff
   */
  calculateDelay(attempt: number, baseDelay: number = 1000, maxDelay: number = 30000): number {
    const delay = baseDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, maxDelay);
  },

  /**
   * Determine if operation should be retried
   */
  shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean {
    if (attempt >= maxAttempts) return false;
    
    const category = errorUtils.categorizeError(error);
    return category.retryable;
  },

  /**
   * Execute operation with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      baseDelay?: number;
      maxDelay?: number;
      onRetry?: (attempt: number, error: unknown) => void;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      onRetry
    } = options;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!retryUtils.shouldRetry(error, attempt, maxAttempts)) {
          throw error;
        }

        if (onRetry) {
          onRetry(attempt, error);
        }

        if (attempt < maxAttempts) {
          const delay = retryUtils.calculateDelay(attempt, baseDelay, maxDelay);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
};

/**
 * Response transformation utilities
 */
export const transformUtils = {
  /**
   * Transform response data using provided mapper
   */
  transformData<TInput, TOutput>(
    data: TInput,
    transformer: (input: TInput) => TOutput
  ): TOutput {
    try {
      return transformer(data);
    } catch (error) {
      throw new Error(`Data transformation failed: ${errorUtils.extractErrorMessage(error)}`);
    }
  },

  /**
   * Transform array data with individual item transformers
   */
  transformArray<TInput, TOutput>(
    data: TInput[],
    transformer: (item: TInput, index: number) => TOutput
  ): TOutput[] {
    return data.map((item, index) => {
      try {
        return transformer(item, index);
      } catch (error) {
        throw new Error(`Failed to transform item at index ${index}: ${errorUtils.extractErrorMessage(error)}`);
      }
    });
  },

  /**
   * Apply multiple transformations in sequence
   */
  pipeline<T>(
    data: T,
    ...transformers: Array<(input: any) => any>
  ): any {
    return transformers.reduce((result, transformer) => {
      return transformUtils.transformData(result, transformer);
    }, data);
  }
};
