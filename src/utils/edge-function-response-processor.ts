export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  duration?: number;
  metadata?: Record<string, any>;
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

export interface ResponseProcessingConfig {
  includeMetadata: boolean;
  validateResponse: boolean;
  logResponses: boolean;
  retryFailedRequests: boolean;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

export class EdgeFunctionResponseProcessor {
  private config: ResponseProcessingConfig;
  private retryAttempts = new Map<string, number>();

  constructor(config: Partial<ResponseProcessingConfig> = {}) {
    this.config = {
      includeMetadata: true,
      validateResponse: true,
      logResponses: false,
      retryFailedRequests: true,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      ...config
    };
  }

  private log(message: string, level: 'info' | 'error' | 'warn' = 'info') {
    if (!this.config.logResponses) return;

    const emoji = { info: '📊', error: '❌', warn: '⚠️' };
    console.log(`${emoji[level]} Response Processor: ${message}`);
  }

  /**
   * Process a raw fetch response into standardized format
   */
  async processResponse<T>(
    response: Response,
    operationName: string,
    startTime: number = Date.now()
  ): Promise<ApiResponse<T>> {
    const duration = Date.now() - startTime;
    const timestamp = new Date().toISOString();

    try {
      this.log(`Processing response for ${operationName} (${response.status})`);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        const text = await response.text();
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        return {
          success: true,
          data: text as T,
          message: `${operationName} completed successfully`,
          timestamp,
          duration,
          metadata: this.config.includeMetadata ? {
            status: response.status,
            contentType,
            operationName
          } : undefined
        };
      }

      // Parse JSON response
      const responseData = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: responseData.error || `HTTP ${response.status}`,
          timestamp,
          duration,
          metadata: this.config.includeMetadata ? {
            status: response.status,
            operationName,
            responseData
          } : undefined
        };
      }

      // Validate response structure if enabled
      if (this.config.validateResponse) {
        const validation = this.validateResponseStructure(responseData);
        if (!validation.isValid) {
          this.log(`Response validation failed: ${validation.errors.map(e => e.message).join(', ')}`, 'warn');
        }
      }

      return {
        success: true,
        data: responseData,
        message: `${operationName} completed successfully`,
        timestamp,
        duration,
        metadata: this.config.includeMetadata ? {
          status: response.status,
          operationName,
          dataSize: JSON.stringify(responseData).length
        } : undefined
      };

    } catch (error: any) {
      this.log(`Error processing response: ${error.message}`, 'error');

      return {
        success: false,
        error: error.message,
        timestamp,
        duration,
        metadata: this.config.includeMetadata ? {
          status: response.status,
          operationName,
          errorType: error.constructor.name
        } : undefined
      };
    }
  }

  /**
   * Make a request with automatic retry logic
   */
  async makeRequest<T>(
    url: string,
    options: RequestInit,
    operationName: string
  ): Promise<ApiResponse<T>> {
    const requestId = `${operationName}-${Date.now()}`;
    const startTime = Date.now();

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        this.log(`Making request to ${operationName} (attempt ${attempt + 1})`);

        // Add timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // If successful or non-retryable error, process and return
        if (response.ok || !this.shouldRetry(response.status)) {
          return this.processResponse<T>(response, operationName, startTime);
        }

        // If retryable error and not last attempt, continue to retry
        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * (attempt + 1)); // Exponential backoff
          continue;
        }

        // Last attempt failed, process the error response
        return this.processResponse<T>(response, operationName, startTime);

      } catch (error: any) {
        lastError = error;
        this.log(`Attempt ${attempt + 1} failed: ${error.message}`, 'warn');

        // If not retrying or last attempt, return error
        if (!this.config.retryFailedRequests || attempt >= this.config.maxRetries) {
          break;
        }

        // Wait before retry
        await this.delay(this.config.retryDelay * (attempt + 1));
      }
    }

    // All attempts failed
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: lastError?.message || 'All retry attempts failed',
      timestamp: new Date().toISOString(),
      duration,
      metadata: this.config.includeMetadata ? {
        operationName,
        attempts: this.config.maxRetries + 1,
        errorType: lastError?.constructor.name
      } : undefined
    };
  }

  /**
   * Determine if a status code should trigger a retry
   */
  private shouldRetry(status: number): boolean {
    // Retry on server errors and rate limiting
    return status >= 500 || status === 429;
  }

  /**
   * Basic response structure validation
   */
  private validateResponseStructure(data: any): ValidationResult {
    const errors: ErrorDetail[] = [];
    const warnings: ErrorDetail[] = [];

    // Check for common response patterns
    if (typeof data === 'object' && data !== null) {
      // Check for error responses
      if ('error' in data && !data.success) {
        warnings.push({
          message: 'Response contains error field',
          severity: 'warning'
        });
      }

      // Check for data field
      if (!('data' in data) && !('results' in data) && !('items' in data)) {
        warnings.push({
          message: 'Response does not contain standard data field',
          severity: 'warning'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Transform response data using provided transformers
   */
  transformResponse<T, R>(
    response: ApiResponse<T>,
    transformer: (data: T) => R
  ): ApiResponse<R> {
    if (!response.success || !response.data) {
      return response as unknown as ApiResponse<R>;
    }

    try {
      const transformedData = transformer(response.data);
      return {
        ...response,
        data: transformedData
      };
    } catch (error: any) {
      this.log(`Data transformation failed: ${error.message}`, 'error');
      return {
        ...response,
        success: false,
        error: `Data transformation failed: ${error.message}`,
        data: undefined
      };
    }
  }

  /**
   * Combine multiple responses into a single response
   */
  combineResponses<T>(responses: ApiResponse<T>[]): ApiResponse<T[]> {
    const errors = responses.filter(r => !r.success);
    const successes = responses.filter(r => r.success);

    if (errors.length === responses.length) {
      // All failed
      return {
        success: false,
        error: `All operations failed: ${errors.map(e => e.error).join(', ')}`,
        timestamp: new Date().toISOString()
      };
    }

    if (errors.length > 0) {
      // Partial success
      this.log(`${errors.length} of ${responses.length} operations failed`, 'warn');
    }

    return {
      success: errors.length === 0,
      data: successes.map(r => r.data!),
      message: `${successes.length} of ${responses.length} operations completed successfully`,
      timestamp: new Date().toISOString(),
      metadata: this.config.includeMetadata ? {
        totalOperations: responses.length,
        successfulOperations: successes.length,
        failedOperations: errors.length,
        errors: errors.map(e => e.error)
      } : undefined
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create response with standardized error handling
   */
  createErrorResponse(error: any, operationName: string): ApiResponse<never> {
    const timestamp = new Date().toISOString();
    
    let errorMessage = 'Unknown error occurred';
    let errorCode: string | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorCode = error.name;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = error.message || error.error || JSON.stringify(error);
      errorCode = error.code || error.name;
    }

    return {
      success: false,
      error: errorMessage,
      timestamp,
      metadata: this.config.includeMetadata ? {
        operationName,
        errorCode,
        errorType: error?.constructor?.name
      } : undefined
    };
  }

  /**
   * Create successful response
   */
  createSuccessResponse<T>(data: T, message?: string, operationName?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message: message || 'Operation completed successfully',
      timestamp: new Date().toISOString(),
      metadata: this.config.includeMetadata ? {
        operationName,
        dataType: typeof data,
        dataSize: typeof data === 'object' ? JSON.stringify(data).length : undefined
      } : undefined
    };
  }
}

// Factory functions for common configurations
export const responseProcessorFactory = {
  /**
   * Create processor for development (verbose logging, validation)
   */
  development: () => new EdgeFunctionResponseProcessor({
    includeMetadata: true,
    validateResponse: true,
    logResponses: true,
    retryFailedRequests: true,
    maxRetries: 2,
    retryDelay: 500,
    timeout: 10000
  }),

  /**
   * Create processor for production (minimal logging, fast retries)
   */
  production: () => new EdgeFunctionResponseProcessor({
    includeMetadata: false,
    validateResponse: false,
    logResponses: false,
    retryFailedRequests: true,
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000
  }),

  /**
   * Create processor for debugging (maximum logging and validation)
   */
  debug: () => new EdgeFunctionResponseProcessor({
    includeMetadata: true,
    validateResponse: true,
    logResponses: true,
    retryFailedRequests: false,
    maxRetries: 0,
    retryDelay: 0,
    timeout: 60000
  })
};

// Common response transformers
export const responseTransformers = {
  /**
   * Extract creatures with XP calculation
   */
  creaturesWithXP: (data: any) => {
    if (!data.creatures) return data;
    
    const XP_BY_CR: Record<number, number> = {
      0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
      1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
      6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
      11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
      16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000
    };
    
    return {
      ...data,
      creatures: data.creatures.map((creature: any) => ({
        ...creature,
        xp_value: XP_BY_CR[creature.challenge_rating] || 0
      }))
    };
  },

  /**
   * Normalize environment data
   */
  normalizeEnvironments: (data: any) => {
    if (!data.environments) return data;
    
    return {
      ...data,
      environments: data.environments.map((env: any) => ({
        ...env,
        terrain_type: Array.isArray(env.terrain_type) ? env.terrain_type : [env.terrain_type].filter(Boolean),
        hazards: Array.isArray(env.hazards) ? env.hazards : [env.hazards].filter(Boolean)
      }))
    };
  },

  /**
   * Add encounter metadata
   */
  addEncounterMetadata: (data: any) => {
    if (!data.creatures) return data;
    
    const totalCreatures = data.creatures.reduce((sum: number, c: any) => sum + (c.quantity || 1), 0);
    const avgCR = data.creatures.reduce((sum: number, c: any) => sum + (c.challenge_rating || 0), 0) / data.creatures.length;
    
    return {
      ...data,
      metadata: {
        total_creatures: totalCreatures,
        average_cr: Math.round(avgCR * 100) / 100,
        creature_types: [...new Set(data.creatures.map((c: any) => c.creature_type).filter(Boolean))]
      }
    };
  }
};
