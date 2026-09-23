import { workerRegistry } from './worker.registry.js';
import { queueRegistry } from '../queues/queue.registry.js';
import { getPrismaClient } from '../database/prisma/tenant-prisma.extension.js';
import { logger } from '../common/logger/logger.service.js';
import { registerProcessErrorHandlers } from '../common/logger/process-error-handlers.js';

async function bootstrapWorkers(): Promise<void> {
  logger.info('=====================================================');
  logger.info('  TrueCO Distributed Background Worker Runner v1.0   ');
  logger.info('=====================================================');

  try {
    // 1. Verify Redis connectivity
    const redis = queueRegistry.getRedisClient();
    const redisPing = await redis.ping();
    logger.info(`[WorkerRunner] Redis connection verified: ${redisPing}`);

    // 2. Start all workers
    await workerRegistry.startAll();
    logger.info('[WorkerRunner] All background queue workers active & listening');

    // 3. Graceful shutdown handler
    const shutdown = async (signal: string) => {
      logger.info(`[WorkerRunner] Received ${signal}. Starting graceful shutdown of workers...`);
      try {
        await workerRegistry.closeAll();
        await queueRegistry.closeAll();
        const prisma = getPrismaClient();
        await (prisma as any).$disconnect();
        logger.info('[WorkerRunner] All workers closed gracefully.');
        process.exit(0);
      } catch (err) {
        logger.error('[WorkerRunner] Error during worker shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('[WorkerRunner] Fatal error starting workers:', err);
    process.exit(1);
  }
}

registerProcessErrorHandlers('WorkerRunner');
bootstrapWorkers();
