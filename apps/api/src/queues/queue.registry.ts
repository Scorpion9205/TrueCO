import { Queue, QueueOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { envConfig } from '../config/env.config.js';
import { logger } from '../common/logger/logger.service.js';

export const QUEUE_NAMES = {
  WHATSAPP: 'whatsapp-queue',
  INBOUND_WHATSAPP: 'inbound-whatsapp-queue',
  EMAIL: 'email-queue',
  REMINDER: 'reminder-queue',
  REPORT: 'report-queue',
  PDF: 'pdf-queue',
  AI: 'ai-queue',
  IMPORT: 'import-queue',
  ANALYTICS: 'analytics-queue',
  CLEANUP: 'cleanup-queue',
  EVENTS: 'events-queue',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export class QueueRegistry {
  private static instance: QueueRegistry;
  private readonly redisConnection: Redis;
  private readonly queues: Map<string, Queue> = new Map();

  private constructor() {
    this.redisConnection = new Redis({
      host: envConfig.get('REDIS_HOST'),
      port: envConfig.get('REDIS_PORT'),
      password: envConfig.get('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: null, // Required by BullMQ
      lazyConnect: true,
    });

    this.redisConnection.on('error', (err: Error) => {
      logger.error('Redis connection error in QueueRegistry:', err);
    });
  }

  public static getInstance(): QueueRegistry {
    if (!QueueRegistry.instance) {
      QueueRegistry.instance = new QueueRegistry();
    }
    return QueueRegistry.instance;
  }

  public getRedisClient(): Redis {
    return this.redisConnection;
  }

  public getQueue(name: QueueName, options?: Partial<QueueOptions>): Queue {
    if (!this.queues.has(name)) {
      const defaultOptions: QueueOptions = {
        connection: this.redisConnection,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
        ...options,
      };

      const queue = new Queue(name, defaultOptions);
      this.queues.set(name, queue);
      logger.info(`[QueueRegistry] Registered queue: ${name}`);
    }

    return this.queues.get(name)!;
  }

  public async closeAll(): Promise<void> {
    logger.info('[QueueRegistry] Closing all queues and Redis connection');
    for (const [name, queue] of this.queues.entries()) {
      await queue.close();
      logger.debug(`[QueueRegistry] Closed queue: ${name}`);
    }
    this.queues.clear();
    await this.redisConnection.quit();
  }
}

export const queueRegistry = QueueRegistry.getInstance();
