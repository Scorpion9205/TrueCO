import pino, { Logger } from 'pino';
import { envConfig } from '../../config/env.config.js';
import { RequestContextService } from '../services/request-context.service.js';

export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export class LoggerService implements ILogger {
  private static instance: LoggerService;
  private readonly pinoLogger: Logger;

  private constructor() {
    const isDev = envConfig.get('NODE_ENV') === 'development';
    this.pinoLogger = pino({
      level: envConfig.get('LOG_LEVEL'),
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    });
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private enrich(meta?: Record<string, unknown>): Record<string, unknown> {
    const context = RequestContextService.getContext();
    return {
      traceId: context?.traceId,
      coachingId: context?.coachingId,
      userId: context?.userId,
      ...meta,
    };
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.pinoLogger.info(this.enrich(meta), message);
  }

  public error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const errorMeta = error instanceof Error ? { errorName: error.name, errorMessage: error.message, stack: error.stack } : { error };
    this.pinoLogger.error({ ...this.enrich(meta), ...errorMeta }, message);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.pinoLogger.warn(this.enrich(meta), message);
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.pinoLogger.debug(this.enrich(meta), message);
  }
}

export const logger = LoggerService.getInstance();
