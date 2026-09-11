import { PrismaClient } from '@prisma/client';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { logger } from '../../common/logger/logger.service.js';

// Models that are scoped to a specific coaching institute
const TENANT_SCOPED_MODELS = new Set<string>([
  'User',
  'Student',
  'Parent',
  'StudentParent',
  'Teacher',
  'Batch',
  'BatchStudent',
  'TeacherBatch',
  'AttendanceSession',
  'AttendanceRecord',
  'Test',
  'TestResult',
  'Homework',
  'FeePlan',
  'FeeInstallment',
  'FeeTransaction',
  'Salary',
  'Expense',
  'NotificationHistory',
  'StudentTimeline',
  'RiskScore',
  'Subscription',
  'AiCreditWallet',
  'Setting',
  'AuditLog',
]);

export function createTenantPrismaClient(baseClient?: PrismaClient) {
  const client = baseClient ?? new PrismaClient();

  return client.$extends({
    name: 'TenantIsolationAndSoftDelete',
    query: {
      $allModels: {
        async findMany({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const coachingId = RequestContextService.getCoachingId();
            args.where = {
              ...args.where,
              deletedAt: null,
              ...(coachingId ? { coachingId } : {}),
            };
          }
          return query(args);
        },

        async findFirst({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const coachingId = RequestContextService.getCoachingId();
            args.where = {
              ...args.where,
              deletedAt: null,
              ...(coachingId ? { coachingId } : {}),
            };
          }
          return query(args);
        },

        async findUnique({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const coachingId = RequestContextService.getCoachingId();
            if (coachingId && args?.where) {
              const modifiedWhere = {
                ...args.where,
                deletedAt: null,
                coachingId,
              };
              return (client as any)[model].findFirst({ where: modifiedWhere });
            }
          }
          return query(args);
        },

        async count({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const coachingId = RequestContextService.getCoachingId();
            args.where = {
              ...args.where,
              deletedAt: null,
              ...(coachingId ? { coachingId } : {}),
            };
          }
          return query(args);
        },

        async create({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const coachingId = RequestContextService.getCoachingId();
            const userId = RequestContextService.getUserId();
            args.data = {
              ...args.data,
              ...(coachingId ? { coachingId } : {}),
              ...(userId ? { createdBy: userId } : {}),
            };
          }
          return query(args);
        },

        async update({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const coachingId = RequestContextService.getCoachingId();
            const userId = RequestContextService.getUserId();
            if (coachingId) {
              args.where = {
                ...args.where,
                coachingId,
              };
            }
            args.data = {
              ...args.data,
              ...(userId ? { updatedBy: userId } : {}),
            };
          }
          return query(args);
        },

        async delete({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          // Soft-delete interceptor
          if (TENANT_SCOPED_MODELS.has(model)) {
            const coachingId = RequestContextService.getCoachingId();
            const userId = RequestContextService.getUserId();
            logger.debug(`[PrismaMiddleware] Rewriting hard delete to soft delete for ${model}`, {
              where: args.where,
            });
            return (client as any)[model].update({
              where: {
                ...args.where,
                ...(coachingId ? { coachingId } : {}),
              },
              data: {
                deletedAt: new Date(),
                ...(userId ? { updatedBy: userId } : {}),
              },
            });
          }
          return query(args);
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof createTenantPrismaClient>;

// Singleton database connection
let prismaInstance: ExtendedPrismaClient | null = null;

export function getPrismaClient(): ExtendedPrismaClient {
  if (!prismaInstance) {
    const rawClient = new PrismaClient({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'error' },
              { emit: 'stdout', level: 'warn' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });

    if (process.env.NODE_ENV === 'development') {
      (rawClient as any).$on('query', (e: any) => {
        logger.debug(`[Prisma Query] (${e.duration}ms) ${e.query}`);
      });
    }

    prismaInstance = createTenantPrismaClient(rawClient);
  }
  return prismaInstance;
}
