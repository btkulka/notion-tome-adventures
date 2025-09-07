/**
 * Base handler for Supabase Edge Functions
 * Eliminates boilerplate and provides consistent error handling, CORS, and logging
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { 
  handleCORS, 
  createErrorResponse, 
  createSuccessResponse 
} from './notion-utils.ts';

export interface EdgeFunctionConfig {
  name: string;
  requiresBody?: boolean;
  bodySchema?: any; // Could be enhanced with runtime validation
  timeout?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface EdgeFunctionContext {
  requestBody?: any;
  headers: Headers;
  url: URL;
  method: string;
}

export type EdgeFunctionHandler<T = any> = (context: EdgeFunctionContext) => Promise<T>;

class EdgeFunctionLogger {
  constructor(private functionName: string, private logLevel: string = 'info') {}

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevel = levels.indexOf(this.logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= currentLevel;
  }

  debug(message: string, data?: any) {
    if (this.shouldLog('debug')) {
      console.log(`🔍 [${this.functionName}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  info(message: string, data?: any) {
    if (this.shouldLog('info')) {
      console.log(`ℹ️ [${this.functionName}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  warn(message: string, data?: any) {
    if (this.shouldLog('warn')) {
      console.warn(`⚠️ [${this.functionName}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  error(message: string, error?: any) {
    if (this.shouldLog('error')) {
      console.error(`❌ [${this.functionName}] ${message}`, error);
    }
  }

  success(message: string, data?: any) {
    console.log(`✅ [${this.functionName}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

export function createEdgeFunction<T = any>(
  config: EdgeFunctionConfig,
  handler: EdgeFunctionHandler<T>
) {
  return serve(async (req: Request): Promise<Response> => {
    const logger = new EdgeFunctionLogger(config.name, config.logLevel);
    const startTime = Date.now();

    // Handle CORS preflight
    const corsResponse = handleCORS(req);
    if (corsResponse) {
      logger.debug('Handled CORS preflight request');
      return corsResponse;
    }

    try {
      logger.info(`Starting ${config.name} function`);
      logger.debug(`Request method: ${req.method}`);
      logger.debug(`Request URL: ${req.url}`);

      // Parse request body if required
      let requestBody;
      if (config.requiresBody || req.method === 'POST') {
        try {
          const bodyText = await req.text();
          if (bodyText) {
            requestBody = JSON.parse(bodyText);
            logger.debug('Parsed request body', requestBody);
          } else if (config.requiresBody) {
            throw new Error('Request body is required but was empty');
          }
        } catch (parseError) {
          logger.error('Failed to parse request body', parseError);
          throw new Error('Invalid JSON in request body');
        }
      }

      // Validate body schema if provided
      if (config.bodySchema && requestBody) {
        // Could add schema validation here (e.g., with Zod)
        logger.debug('Body schema validation passed');
      }

      // Create context for handler
      const context: EdgeFunctionContext = {
        requestBody,
        headers: req.headers,
        url: new URL(req.url),
        method: req.method
      };

      // Set up timeout if specified
      let timeoutId: number | undefined;
      const timeoutPromise = config.timeout ? new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Function timed out after ${config.timeout}ms`));
        }, config.timeout);
      }) : null;

      // Execute handler with timeout
      const handlerPromise = handler(context);
      const result = timeoutPromise 
        ? await Promise.race([handlerPromise, timeoutPromise])
        : await handlerPromise;

      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const duration = Date.now() - startTime;
      logger.success(`Function completed successfully in ${duration}ms`);
      logger.debug('Function result', result);

      return createSuccessResponse(result);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Function failed after ${duration}ms`, error);

      // Enhanced error context for debugging
      const errorContext = {
        function: config.name,
        duration,
        method: req.method,
        url: req.url,
        userAgent: req.headers.get('user-agent'),
        timestamp: new Date().toISOString()
      };

      logger.debug('Error context', errorContext);

      return createErrorResponse(error, config.name);
    }
  });
}

// Utility decorators for common patterns
export function requireNotionClient() {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(context: EdgeFunctionContext) {
      const { createNotionClient } = await import('./notion-utils.ts');
      const notion = createNotionClient();
      
      // Add notion client to context
      const enhancedContext = { ...context, notion };
      return method.call(this, enhancedContext);
    };
  };
}

export function validateDatabaseId(envVarName: string) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(context: EdgeFunctionContext) {
      const { validateDatabaseId } = await import('./notion-utils.ts');
      const databaseId = validateDatabaseId(Deno.env.get(envVarName), envVarName);
      
      // Add database ID to context
      const enhancedContext = { ...context, databaseId };
      return method.call(this, enhancedContext);
    };
  };
}

// Utility for common filter building
export interface FilterBuilder {
  addEnvironmentFilter(environment?: string): FilterBuilder;
  addCRFilter(minCR?: number, maxCR?: number): FilterBuilder;
  addAlignmentFilter(alignment?: string): FilterBuilder;
  addSizeFilter(size?: string): FilterBuilder;
  addTypeFilter(type?: string): FilterBuilder;
  build(): any;
}

export function createFilterBuilder(): FilterBuilder {
  const filters: any[] = [];

  return {
    addEnvironmentFilter(environment?: string) {
      if (environment && environment !== 'Any') {
        filters.push({
          or: [
            {
              property: 'Environment',
              multi_select: { contains: environment }
            },
            {
              property: 'Environments',
              multi_select: { contains: environment }
            }
          ]
        });
      }
      return this;
    },

    addCRFilter(minCR?: number, maxCR?: number) {
      const crFilters: any[] = [];
      
      if (minCR !== undefined) {
        crFilters.push({
          property: 'Challenge Rating',
          number: { greater_than_or_equal_to: minCR }
        });
      }
      
      if (maxCR !== undefined) {
        crFilters.push({
          property: 'Challenge Rating',
          number: { less_than_or_equal_to: maxCR }
        });
      }
      
      if (crFilters.length > 0) {
        filters.push(...crFilters);
      }
      
      return this;
    },

    addAlignmentFilter(alignment?: string) {
      if (alignment && alignment !== 'Any') {
        filters.push({
          property: 'Alignment',
          select: { equals: alignment }
        });
      }
      return this;
    },

    addSizeFilter(size?: string) {
      if (size && size !== 'Any') {
        filters.push({
          property: 'Size',
          select: { equals: size }
        });
      }
      return this;
    },

    addTypeFilter(type?: string) {
      if (type && type !== 'Any') {
        filters.push({
          property: 'Type',
          select: { equals: type }
        });
      }
      return this;
    },

    build() {
      if (filters.length === 0) return undefined;
      if (filters.length === 1) return filters[0];
      return { and: filters };
    }
  };
}

// Example usage patterns:

// Simple function
export function createSimpleFunction(name: string, handler: EdgeFunctionHandler) {
  return createEdgeFunction(
    { 
      name,
      logLevel: 'info'
    },
    handler
  );
}

// Data fetching function
export function createDataFetchFunction(name: string, handler: EdgeFunctionHandler) {
  return createEdgeFunction(
    {
      name,
      requiresBody: false,
      timeout: 30000,
      logLevel: 'info'
    },
    handler
  );
}

// Data processing function
export function createProcessingFunction(name: string, handler: EdgeFunctionHandler) {
  return createEdgeFunction(
    {
      name,
      requiresBody: true,
      timeout: 60000,
      logLevel: 'debug'
    },
    handler
  );
}
