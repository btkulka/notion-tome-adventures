/**
 * Standard Edge Function Architecture
 * Provides consistent structure for all edge functions
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { 
  handleCORS, 
  createNotionClient, 
  validateDatabaseId, 
  createErrorResponse, 
  createSuccessResponse 
} from './notion-utils.ts';

export interface EdgeFunctionConfig {
  name: string;
  description: string;
  requiresAuth?: boolean;
  requiresDatabase?: string[];
  timeout?: number;
  enableLogging?: boolean;
  corsEnabled?: boolean;
}

export interface EdgeFunctionContext {
  request: Request;
  notion: any;
  databases: Record<string, string>;
  requestId: string;
  startTime: number;
}

export type EdgeFunctionHandler = (
  context: EdgeFunctionContext,
  body: any
) => Promise<Response>;

export class EdgeFunctionBuilder {
  private config: EdgeFunctionConfig;
  private handler: EdgeFunctionHandler;
  private middlewares: Array<(context: EdgeFunctionContext, body: any) => Promise<void>> = [];

  constructor(config: EdgeFunctionConfig) {
    this.config = config;
  }

  use(middleware: (context: EdgeFunctionContext, body: any) => Promise<void>): this {
    this.middlewares.push(middleware);
    return this;
  }

  handle(handler: EdgeFunctionHandler): this {
    this.handler = handler;
    return this;
  }

  private log(context: EdgeFunctionContext, message: string, level: 'info' | 'error' | 'warn' = 'info') {
    if (!this.config.enableLogging) return;

    const emoji = {
      info: '🔍',
      error: '❌',
      warn: '⚠️'
    };

    const duration = Date.now() - context.startTime;
    console.log(`${emoji[level]} [${context.requestId}:${duration}ms] ${this.config.name}: ${message}`);
  }

  private async validateDatabases(context: EdgeFunctionContext): Promise<Record<string, string>> {
    const databases: Record<string, string> = {};

    if (this.config.requiresDatabase) {
      for (const dbName of this.config.requiresDatabase) {
        const envVarName = `${dbName.toUpperCase()}_DATABASE_ID`;
        const dbId = validateDatabaseId(Deno.env.get(envVarName), envVarName);
        databases[dbName] = dbId;
        this.log(context, `Validated ${dbName} database: ${dbId.substring(0, 8)}...`);
      }
    }

    return databases;
  }

  private async createContext(request: Request): Promise<EdgeFunctionContext> {
    const requestId = crypto.randomUUID().substring(0, 8);
    const startTime = Date.now();

    const context: EdgeFunctionContext = {
      request,
      notion: createNotionClient(),
      databases: {},
      requestId,
      startTime
    };

    this.log(context, `Starting ${this.config.description}`);

    // Validate required databases
    context.databases = await this.validateDatabases(context);

    return context;
  }

  build() {
    if (!this.handler) {
      throw new Error(`Edge function ${this.config.name} must have a handler`);
    }

    return serve(async (req: Request) => {
      // Handle CORS
      if (this.config.corsEnabled !== false) {
        const corsResponse = handleCORS(req);
        if (corsResponse) return corsResponse;
      }

      let context: EdgeFunctionContext;
      
      try {
        // Create context
        context = await this.createContext(req);

        // Parse request body
        let body = {};
        try {
          const text = await req.text();
          if (text) {
            body = JSON.parse(text);
          }
        } catch (error) {
          this.log(context, `Failed to parse request body: ${error.message}`, 'warn');
        }

        this.log(context, `Request body: ${JSON.stringify(body)}`);

        // Run middlewares
        for (const middleware of this.middlewares) {
          await middleware(context, body);
        }

        // Execute main handler
        const response = await this.handler(context, body);
        
        const duration = Date.now() - context.startTime;
        this.log(context, `Completed successfully in ${duration}ms`);
        
        return response;

      } catch (error: any) {
        const duration = context ? Date.now() - context.startTime : 0;
        const errorMsg = `Failed after ${duration}ms: ${error.message}`;
        
        if (context) {
          this.log(context, errorMsg, 'error');
        } else {
          console.error(`❌ ${this.config.name}: ${errorMsg}`);
        }

        return createErrorResponse(error, this.config.name);
      }
    });
  }
}

// Common middleware functions
export const commonMiddleware = {
  /**
   * Validates required environment variables
   */
  validateEnvVars: (requiredVars: string[]) => {
    return async (context: EdgeFunctionContext, body: any) => {
      for (const varName of requiredVars) {
        if (!Deno.env.get(varName)) {
          throw new Error(`Missing required environment variable: ${varName}`);
        }
      }
    };
  },

  /**
   * Validates request body schema
   */
  validateSchema: (schema: Record<string, any>) => {
    return async (context: EdgeFunctionContext, body: any) => {
      for (const [key, config] of Object.entries(schema)) {
        if (config.required && !(key in body)) {
          throw new Error(`Missing required field: ${key}`);
        }
        if (config.type && body[key] !== undefined && typeof body[key] !== config.type) {
          throw new Error(`Field ${key} must be of type ${config.type}`);
        }
      }
    };
  },

  /**
   * Adds request timing and logging
   */
  timing: () => {
    return async (context: EdgeFunctionContext, body: any) => {
      // Timing is already handled in the main builder
      // This is a placeholder for additional timing logic
    };
  },

  /**
   * Rate limiting (basic implementation)
   */
  rateLimit: (requestsPerMinute: number) => {
    const requests = new Map<string, number[]>();
    
    return async (context: EdgeFunctionContext, body: any) => {
      const clientId = context.request.headers.get('x-forwarded-for') || 'unknown';
      const now = Date.now();
      const windowStart = now - 60000; // 1 minute window

      if (!requests.has(clientId)) {
        requests.set(clientId, []);
      }

      const clientRequests = requests.get(clientId)!;
      
      // Remove old requests
      const validRequests = clientRequests.filter(time => time > windowStart);
      
      if (validRequests.length >= requestsPerMinute) {
        throw new Error('Rate limit exceeded');
      }

      validRequests.push(now);
      requests.set(clientId, validRequests);
    };
  }
};

// Factory functions for common edge function patterns
export class EdgeFunctionFactory {
  /**
   * Creates a data fetching function
   */
  static createDataFetcher(
    name: string,
    description: string,
    databases: string[],
    fetchHandler: (context: EdgeFunctionContext, body: any) => Promise<any>
  ) {
    return new EdgeFunctionBuilder({
      name,
      description,
      requiresDatabase: databases,
      enableLogging: true
    })
    .use(commonMiddleware.timing())
    .handle(async (context, body) => {
      const data = await fetchHandler(context, body);
      return createSuccessResponse(data);
    })
    .build();
  }

  /**
   * Creates a data processing function
   */
  static createDataProcessor(
    name: string,
    description: string,
    databases: string[],
    processHandler: (context: EdgeFunctionContext, body: any) => Promise<any>
  ) {
    return new EdgeFunctionBuilder({
      name,
      description,
      requiresDatabase: databases,
      enableLogging: true
    })
    .use(commonMiddleware.timing())
    .handle(async (context, body) => {
      const result = await processHandler(context, body);
      return createSuccessResponse(result);
    })
    .build();
  }

  /**
   * Creates a field fixing function
   */
  static createFieldFixer(
    name: string,
    description: string,
    databases: string[],
    fixHandler: (context: EdgeFunctionContext, body: any) => Promise<any>
  ) {
    return new EdgeFunctionBuilder({
      name,
      description,
      requiresDatabase: databases,
      enableLogging: true
    })
    .use(commonMiddleware.timing())
    .handle(async (context, body) => {
      const result = await fixHandler(context, body);
      return createSuccessResponse(result);
    })
    .build();
  }

  /**
   * Creates a simple test function
   */
  static createTester(
    name: string,
    description: string,
    testHandler: (context: EdgeFunctionContext, body: any) => Promise<any>
  ) {
    return new EdgeFunctionBuilder({
      name,
      description,
      enableLogging: true
    })
    .handle(async (context, body) => {
      const result = await testHandler(context, body);
      return createSuccessResponse(result);
    })
    .build();
  }
}

// Utility for creating standard responses
export const responseUtils = {
  success: (data: any, message?: string) => createSuccessResponse({ 
    data, 
    message: message || 'Operation completed successfully',
    timestamp: new Date().toISOString()
  }),

  error: (error: any, operation?: string) => createErrorResponse(error, operation),

  validation: (errors: string[]) => new Response(
    JSON.stringify({
      success: false,
      error: 'Validation failed',
      details: errors,
      timestamp: new Date().toISOString()
    }),
    { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  ),

  notFound: (resource: string) => new Response(
    JSON.stringify({
      success: false,
      error: `${resource} not found`,
      timestamp: new Date().toISOString()
    }),
    { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    }
  )
};
