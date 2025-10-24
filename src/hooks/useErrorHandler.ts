import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface ErrorContext {
  operation: string;
  context?: string;
  timestamp?: string;
}

export interface ErrorState {
  error: string | null;
  isLoading: boolean;
  context: ErrorContext | null;
}

interface UseErrorHandlerReturn {
  error: string | null;
  isLoading: boolean;
  context: ErrorContext | null;
  executeWithErrorHandling: <T>(
    operation: () => Promise<T>,
    operationName: string,
    options?: {
      showToast?: boolean;
      toastTitle?: string;
      toastDescription?: string;
      logDetails?: boolean;
    }
  ) => Promise<T>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export const useErrorHandler = (): UseErrorHandlerReturn => {
  const [state, setState] = useState<ErrorState>({
    error: null,
    isLoading: false,
    context: null
  });
  const { toast } = useToast();

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string,
    options: {
      showToast?: boolean;
      toastTitle?: string;
      toastDescription?: string;
      logDetails?: boolean;
    } = {}
  ): Promise<T> => {
    const {
      showToast = true,
      toastTitle,
      toastDescription,
      logDetails = true
    } = options;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const result = await operation();
      
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (err: unknown) {
      const errorContext: ErrorContext = {
        operation: operationName,
        timestamp: new Date().toISOString()
      };

      let errorMessage = `Failed to ${operationName}`;
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setState({
        error: errorMessage,
        isLoading: false,
        context: errorContext
      });

      // Show toast notification if requested
      if (showToast) {
        toast({
          title: toastTitle || `${operationName} Failed`,
          description: toastDescription || errorMessage,
          variant: "destructive"
        });
      }
      
      throw new Error(errorMessage);
    }
  }, [toast]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, context: null }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  return {
    error: state.error,
    isLoading: state.isLoading,
    context: state.context,
    executeWithErrorHandling,
    clearError,
    setLoading
  };
};
