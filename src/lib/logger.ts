// src/lib/logger.ts
// Centralized logging utility with different log levels

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
  userId?: string;
  context?: string;
}

class Logger {
  private isProduction = process.env.NODE_ENV === 'production';
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatMessage(entry: LogEntry): string {
    const { level, message, timestamp, context } = entry;
    const prefix = context ? `[${context}]` : '';
    return `${timestamp} [${level.toUpperCase()}] ${prefix} ${message}`;
  }

  private log(entry: LogEntry): void {
    const formattedMessage = this.formatMessage(entry);

    // In development, log everything to console with colors
    if (this.isDevelopment) {
      switch (entry.level) {
        case 'error':
          console.error(formattedMessage, entry.data || '');
          break;
        case 'warn':
          console.warn(formattedMessage, entry.data || '');
          break;
        case 'debug':
          console.debug(formattedMessage, entry.data || '');
          break;
        default:
          console.log(formattedMessage, entry.data || '');
      }
      return;
    }

    // In production, only log warnings and errors to console
    // Later, you can send these to a service like Sentry, LogRocket, etc.
    if (this.isProduction && (entry.level === 'error' || entry.level === 'warn')) {
      console.error(formattedMessage, entry.data || '');
      
      // TODO: Send to error tracking service
      // Example: Sentry.captureMessage(formattedMessage, { level: entry.level, extra: entry.data });
    }
  }

  info(message: string, data?: unknown, context?: string): void {
    this.log({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      data,
      context,
    });
  }

  warn(message: string, data?: unknown, context?: string): void {
    this.log({
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      data,
      context,
    });
  }

  error(message: string, error?: Error | unknown, context?: string): void {
    this.log({
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      data: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      context,
    });
  }

  debug(message: string, data?: unknown, context?: string): void {
    // Only log debug in development
    if (this.isDevelopment) {
      this.log({
        level: 'debug',
        message,
        timestamp: new Date().toISOString(),
        data,
        context,
      });
    }
  }

  // Track user actions (useful for audit trails)
  audit(message: string, userId: string, data?: unknown): void {
    this.log({
      level: 'info',
      message: `[AUDIT] ${message}`,
      timestamp: new Date().toISOString(),
      data,
      userId,
      context: 'AUDIT',
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export helper functions for easier use
export const logInfo = (message: string, data?: unknown, context?: string) => 
  logger.info(message, data, context);

export const logWarn = (message: string, data?: unknown, context?: string) => 
  logger.warn(message, data, context);

export const logError = (message: string, error?: Error | unknown, context?: string) => 
  logger.error(message, error, context);

export const logDebug = (message: string, data?: unknown, context?: string) => 
  logger.debug(message, data, context);

export const logAudit = (message: string, userId: string, data?: unknown) => 
  logger.audit(message, userId, data);

