/**
 * Unified response handling utilities
 * Consolidates repeated error handling and response processing patterns
 */

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  success: boolean;
  status?: number;
}

export class ResponseHandler {
  static async handleResponse<T = unknown>(response: Response): Promise<ApiResponse<T>> {
    try {
      const contentType = response.headers.get('content-type');
      
      // Handle non-JSON responses
      if (!contentType?.includes('application/json')) {
        const text = await response.text();
        
        if (!response.ok) {
          return {
            success: false,
            error: `HTTP ${response.status}: ${text}`,
            status: response.status
          };
        }

        return {
          success: true,
          data: text as T
        };
      }

      // Handle JSON responses
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || data.message || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status
        };
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  static createErrorMessage(error: unknown, context?: string): string {
    const prefix = context ? `${context}: ` : '';
    
    if (error instanceof Error) {
      return `${prefix}${error.message}`;
    }
    
    if (typeof error === 'string') {
      return `${prefix}${error}`;
    }
    
    if (error && typeof error === 'object' && 'message' in error) {
      return `${prefix}${String(error.message)}`;
    }
    
    return `${prefix}An unexpected error occurred`;
  }

  static isNotionError(error: unknown): boolean {
    return error && typeof error === 'object' && 'code' in error;
  }

  static handleNotionError(error: unknown): string {
    if (!this.isNotionError(error)) {
      return this.createErrorMessage(error);
    }

    const notionError = error as { code: string; message?: string };
    
    switch (notionError.code) {
      case 'unauthorized':
        return 'Invalid Notion API key. Please check your credentials.';
      case 'object_not_found':
        return 'Notion database not found. Please check the database ID and permissions.';
      case 'rate_limited':
        return 'Rate limit exceeded. Please try again later.';
      default:
        return notionError.message || 'Notion API error occurred';
    }
  }
}

// Utility for consistent loading states
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  data: unknown | null;
}

export const createLoadingState = (isLoading = false, error: string | null = null, data: unknown | null = null): LoadingState => ({
  isLoading,
  error,
  data
});