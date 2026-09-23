import { Worker, Job } from 'bullmq';
import { QueueRegistry, QUEUE_NAMES } from '../queues/queue.registry.js';
import { getPrismaClient, ExtendedPrismaClient } from '../database/prisma/tenant-prisma.extension.js';
import { logger } from '../common/logger/logger.service.js';
import { runJobForTenant } from './job-context.js';

export interface ImportJobPayload {
  readonly coachingId: string;
  readonly entityType: 'STUDENTS' | 'TEACHERS' | 'BATCHES';
  readonly rows: any[];
  readonly requestedBy?: string;
}

export interface ImportError {
  readonly row: number;
  readonly error: string;
}

export interface ImportJobResult {
  readonly status: 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED';
  readonly processedCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly errors: ImportError[];
}

export class ImportWorker {
  private worker: Worker | null = null;

  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public start(): Worker {
    const queueRegistry = QueueRegistry.getInstance();
    const redis = queueRegistry.getRedisClient();

    this.worker = new Worker(
      QUEUE_NAMES.IMPORT,
      async (job: Job<ImportJobPayload>): Promise<ImportJobResult> => {
        logger.info(
          `[ImportWorker] Processing bulk ${job.data.entityType} import (${job.data.rows?.length || 0} rows)`,
        );
        return runJobForTenant(job, () => this.processJob(job.data));
      },
      {
        connection: redis,
        concurrency: 2,
      },
    );

    this.worker.on('completed', (job: Job) => {
      logger.debug(`[ImportWorker] Import Job ${job.id} completed`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`[ImportWorker] Import Job ${job?.id} failed:`, err);
    });

    logger.info('[ImportWorker] Worker started listening to import-queue');
    return this.worker;
  }

  public async processJob(payload: ImportJobPayload): Promise<ImportJobResult> {
    const rows = payload.rows || [];
    const errors: ImportError[] = [];
    let successCount = 0;

    const CHUNK_SIZE = 25;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);

      for (let j = 0; j < chunk.length; j++) {
        const rowIndex = i + j + 1;
        const rowData = chunk[j];

        try {
          await this.importRow(payload.entityType, payload.coachingId, rowData);
          successCount++;
        } catch (err: any) {
          errors.push({
            row: rowIndex,
            error: err?.message || 'Unknown database error',
          });
        }
      }
    }

    const failureCount = errors.length;
    let status: ImportJobResult['status'] = 'COMPLETED';
    if (failureCount > 0 && successCount > 0) {
      status = 'PARTIAL_SUCCESS';
    } else if (failureCount > 0 && successCount === 0) {
      status = 'FAILED';
    }

    logger.info(
      `[ImportWorker] Completed ${payload.entityType} import: ${successCount} succeeded, ${failureCount} failed`,
    );

    return {
      status,
      processedCount: rows.length,
      successCount,
      failureCount,
      errors,
    };
  }

  private async importRow(
    entityType: ImportJobPayload['entityType'],
    coachingId: string,
    row: Record<string, any>,
  ): Promise<void> {
    const rawPrisma = this.prisma as any;

    switch (entityType) {
      case 'STUDENTS': {
        if (!row.firstName || !row.lastName) {
          throw new Error('Missing required student names (firstName, lastName)');
        }
        await rawPrisma.student.create({
          data: {
            coachingId,
            firstName: String(row.firstName).trim(),
            lastName: String(row.lastName).trim(),
            rollNumber: row.rollNumber ? String(row.rollNumber).trim() : undefined,
            phone: row.phone ? String(row.phone).trim() : undefined,
            email: row.email ? String(row.email).trim() : undefined,
            gender: row.gender ? String(row.gender).trim() : undefined,
            dob: row.dob ? new Date(row.dob) : undefined,
            address: row.address ? String(row.address).trim() : undefined,
          },
        });
        break;
      }

      case 'TEACHERS': {
        if (!row.name) {
          throw new Error('Missing required teacher name');
        }
        await rawPrisma.teacher.create({
          data: {
            coachingId,
            name: String(row.name).trim(),
            phone: row.phone ? String(row.phone).trim() : undefined,
            email: row.email ? String(row.email).trim() : undefined,
            subject: row.subject ? String(row.subject).trim() : undefined,
          },
        });
        break;
      }

      case 'BATCHES': {
        if (!row.name || !row.academicYear) {
          throw new Error('Missing required batch name or academicYear');
        }
        await rawPrisma.batch.create({
          data: {
            coachingId,
            name: String(row.name).trim(),
            subject: row.subject ? String(row.subject).trim() : undefined,
            academicYear: String(row.academicYear).trim(),
            startTime: row.startTime ? String(row.startTime).trim() : undefined,
            endTime: row.endTime ? String(row.endTime).trim() : undefined,
            daysOfWeek: Array.isArray(row.daysOfWeek) ? row.daysOfWeek : [],
          },
        });
        break;
      }

      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
