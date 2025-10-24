/**
 * Safe Logger Wrapper
 * Provides graceful fallback logging that won't crash during HMR
 */
import { logger, createLogger, type LoggerConfig } from './logger';

export const safeLogger = {
  debug: (message: string, data?: any) => {
    try {
      logger.debug(message, data);
    } catch (e) {
      console.log('[SAFE-DEBUG]', message, data);
    }
  },
  
  info: (message: string, data?: any) => {
    try {
      logger.info(message, data);
    } catch (e) {
      console.log('[SAFE-INFO]', message, data);
    }
  },
  
  warn: (message: string, data?: any) => {
    try {
      logger.warn(message, data);
    } catch (e) {
      console.warn('[SAFE-WARN]', message, data);
    }
  },
  
  error: (message: string, error?: any) => {
    try {
      logger.error(message, error);
    } catch (e) {
      console.error('[SAFE-ERROR]', message, error);
    }
  },
  
  encounter: (message: string, data?: any) => {
    try {
      logger.encounter(message, data);
    } catch (e) {
      console.log('[SAFE-ENCOUNTER]', message, data);
    }
  },
  
  notion: (message: string, data?: any) => {
    try {
      logger.notion(message, data);
    } catch (e) {
      console.log('[SAFE-NOTION]', message, data);
    }
  },
  
  generation: (message: string, data?: any) => {
    try {
      logger.generation(message, data);
    } catch (e) {
      console.log('[SAFE-GENERATION]', message, data);
    }
  },
  
  performance: (operation: string, durationMs: number, data?: any) => {
    try {
      logger.performance(operation, durationMs, data);
    } catch (e) {
      console.log(`[SAFE-PERF] ${operation} ${durationMs.toFixed(2)}ms`, data);
    }
  },
  
  stateChange: (component: string, changes: Record<string, any>) => {
    try {
      logger.stateChange(component, changes);
    } catch (e) {
      console.log(`[SAFE-STATE] ${component}`, changes);
    }
  },
  
  apiCall: (endpoint: string, method: string, details?: any) => {
    try {
      logger.apiCall(endpoint, method, details);
    } catch (e) {
      console.log(`[SAFE-API] ${method} ${endpoint}`, details);
    }
  }
};

export const createSafeLogger = (prefix: string, config?: Partial<LoggerConfig>) => {
  let prefixedLogger: ReturnType<typeof createLogger> | null = null;
  
  const getLogger = () => {
    if (!prefixedLogger) {
      try {
        prefixedLogger = createLogger(prefix, config);
      } catch (e) {
        console.warn(`Failed to create logger with prefix "${prefix}"`, e);
      }
    }
    return prefixedLogger;
  };
  
  return {
    debug: (message: string, data?: any) => {
      try {
        getLogger()?.debug(message, data);
      } catch (e) {
        console.log(`[${prefix}]`, message, data);
      }
    },
    
    info: (message: string, data?: any) => {
      try {
        getLogger()?.info(message, data);
      } catch (e) {
        console.log(`[${prefix}]`, message, data);
      }
    },
    
    warn: (message: string, data?: any) => {
      try {
        getLogger()?.warn(message, data);
      } catch (e) {
        console.warn(`[${prefix}]`, message, data);
      }
    },
    
    error: (message: string, error?: any) => {
      try {
        getLogger()?.error(message, error);
      } catch (e) {
        console.error(`[${prefix}]`, message, error);
      }
    },
    
    encounter: (message: string, data?: any) => {
      try {
        getLogger()?.encounter(message, data);
      } catch (e) {
        console.log(`[${prefix}] 🎲`, message, data);
      }
    },
    
    notion: (message: string, data?: any) => {
      try {
        getLogger()?.notion(message, data);
      } catch (e) {
        console.log(`[${prefix}] 📋`, message, data);
      }
    },
    
    generation: (message: string, data?: any) => {
      try {
        getLogger()?.generation(message, data);
      } catch (e) {
        console.log(`[${prefix}] ⚡`, message, data);
      }
    },
    
    performance: (operation: string, durationMs: number, data?: any) => {
      try {
        getLogger()?.performance(operation, durationMs, data);
      } catch (e) {
        console.log(`[${prefix}] ⏱️ ${operation} ${durationMs.toFixed(2)}ms`, data);
      }
    },
    
    stateChange: (component: string, changes: Record<string, any>) => {
      try {
        getLogger()?.stateChange(component, changes);
      } catch (e) {
        console.log(`[${prefix}] 🔄 ${component}`, changes);
      }
    },
    
    apiCall: (endpoint: string, method: string, details?: any) => {
      try {
        getLogger()?.apiCall(endpoint, method, details);
      } catch (e) {
        console.log(`[${prefix}] 📡 ${method} ${endpoint}`, details);
      }
    }
  };
};
