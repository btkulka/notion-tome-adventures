/**
 * Application Logger Utility
 * Provides controlled logging that can be disabled in production
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableTimestamp: boolean;
  prefix?: string;
}

class Logger {
  private config: LoggerConfig;
  private initialized = false;

  constructor(config: Partial<LoggerConfig> = {}) {
    // Initialize with safe defaults - lazy init happens on first log
    this.config = {
      level: LogLevel.DEBUG,
      enableConsole: true,
      enableTimestamp: true,
      ...config
    };
  }

  // Lazy initialization - only check env when actually needed
  private ensureInitialized(): void {
    if (this.initialized) return;
    
    try {
      const isProd = import.meta?.env?.PROD === true;
      // Only override if not already set by user config
      if (this.config.level === LogLevel.DEBUG) {
        this.config.level = isProd ? LogLevel.WARN : LogLevel.DEBUG;
      }
      if (this.config.enableConsole === true) {
        this.config.enableConsole = !isProd;
      }
      this.initialized = true;
    } catch (e) {
      // Default to dev mode if env check fails during HMR
      this.initialized = true;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    this.ensureInitialized();
    return level >= this.config.level && this.config.enableConsole;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    try {
      const timestamp = this.config.enableTimestamp 
        ? `[${new Date().toLocaleTimeString()}] ` 
        : '';
      const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
      
      let formatted = `${timestamp}${prefix}${level}: ${message}`;
      
      if (data !== undefined) {
        formatted += ` ${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}`;
      }
      
      return formatted;
    } catch (e) {
      // Fallback to simple message if formatting fails
      return `${level}: ${message}`;
    }
  }

  debug(message: string, data?: any): void {
    try {
      if (this.shouldLog(LogLevel.DEBUG)) {
        console.log(this.formatMessage('🔍 DEBUG', message, data));
      }
    } catch (e) {
      // Silently fail - logging should never crash the app
    }
  }

  info(message: string, data?: any): void {
    try {
      if (this.shouldLog(LogLevel.INFO)) {
        console.info(this.formatMessage('ℹ️ INFO', message, data));
      }
    } catch (e) {
      // Silently fail - logging should never crash the app
    }
  }

  warn(message: string, data?: any): void {
    try {
      if (this.shouldLog(LogLevel.WARN)) {
        console.warn(this.formatMessage('⚠️ WARN', message, data));
      }
    } catch (e) {
      // Silently fail - logging should never crash the app
    }
  }

  error(message: string, error?: any): void {
    try {
      if (this.shouldLog(LogLevel.ERROR)) {
        console.error(this.formatMessage('❌ ERROR', message, error));
      }
    } catch (e) {
      // Silently fail - logging should never crash the app
    }
  }

  // Game-specific logging methods
  encounter(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('🎲 ENCOUNTER', message, data));
    }
  }

  notion(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('📋 NOTION', message, data));
    }
  }

  generation(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('⚡ GENERATION', message, data));
    }
  }

  // Performance tracking
  performance(operation: string, durationMs: number, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = `${operation} completed in ${durationMs.toFixed(2)}ms`;
      console.log(this.formatMessage('⏱️ PERFORMANCE', formatted, data));
    }
  }

  // State change tracking
  stateChange(component: string, changes: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('🔄 STATE', `${component} state changed`, changes));
    }
  }

  // API call tracking
  apiCall(endpoint: string, method: string, details?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('📡 API', `${method} ${endpoint}`, details));
    }
  }
}

// Create default logger instances
export const logger = new Logger();
export const encounterLogger = new Logger({ prefix: 'Encounter' });
export const notionLogger = new Logger({ prefix: 'Notion' });

// Create logger factory for specific modules
export const createLogger = (prefix: string, config?: Partial<LoggerConfig>) => {
  return new Logger({ prefix, ...config });
};

// Export Logger class for external use
export { Logger };

// HMR: Accept hot updates and reset initialization state
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    console.log('🔄 Logger module reloaded');
    if (newModule) {
      // Force re-initialization on next use
      if (logger instanceof Logger) logger['initialized'] = false;
      if (encounterLogger instanceof Logger) encounterLogger['initialized'] = false;
      if (notionLogger instanceof Logger) notionLogger['initialized'] = false;
    }
  });
  
  import.meta.hot.dispose(() => {
    console.log('🧹 Logger module disposing');
  });
}
