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

  constructor(config: Partial<LoggerConfig> = {}) {
    // Safe handling of import.meta.env which might be undefined during initialization
    let isProd = false;
    try {
      isProd = import.meta?.env?.PROD === true;
    } catch (e) {
      // If import.meta is not available, default to development mode
      isProd = false;
    }
    
    this.config = {
      level: isProd ? LogLevel.WARN : LogLevel.DEBUG,
      enableConsole: !isProd,
      enableTimestamp: true,
      ...config
    };
  }

  private shouldLog(level: LogLevel): boolean {
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
