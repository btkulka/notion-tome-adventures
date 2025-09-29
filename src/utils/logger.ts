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
    this.config = {
      level: import.meta.env.PROD ? LogLevel.WARN : LogLevel.DEBUG,
      enableConsole: !import.meta.env.PROD,
      enableTimestamp: true,
      ...config
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level && this.config.enableConsole;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = this.config.enableTimestamp 
      ? `[${new Date().toLocaleTimeString()}] ` 
      : '';
    const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
    
    let formatted = `${timestamp}${prefix}${level}: ${message}`;
    
    if (data !== undefined) {
      formatted += ` ${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}`;
    }
    
    return formatted;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('🔍 DEBUG', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('ℹ️ INFO', message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('⚠️ WARN', message, data));
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('❌ ERROR', message, error));
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
