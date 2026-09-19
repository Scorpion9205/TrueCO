import { PrismaClient } from '@prisma/client';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { logger } from '../../common/logger/logger.service.js';

// Models that are scoped to a specific coaching institute (have coachingId column)
const TENANT_SCOPED_MODELS = new Set<string>([
  'User',
  'UserRole',
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
  'Notice',
]);

// Models that support soft deletion (have deletedAt column)
const SOFT_DELETE_MODELS = new Set<string>([
  'Coaching',
  'User',
  'Role',
  'Student',
  'Parent',
  'Teacher',
  'Batch',
  'AttendanceSession',
  'Test',
  'Homework',
  'FeePlan',
  'FeeInstallment',
  'FeeTransaction',
  'Salary',
  'Expense',
  'Notice',
]);

// Models that track createdBy
const AUDITED_CREATE_MODELS = new Set<string>([
  'User',
  'Student',
  'Parent',
  'Teacher',
  'Batch',
  'Test',
  'Homework',
  'FeePlan',
  'FeeTransaction',
  'Expense',
  'Notice',
]);

// Models that track updatedBy
const AUDITED_UPDATE_MODELS = new Set<string>([
  'User',
  'Student',
  'Parent',
  'Teacher',
  'Batch',
  'Test',
  'Homework',
  'FeePlan',
  'FeeTransaction',
  'Expense',
]);

export function createTenantPrismaClient(baseClient?: PrismaClient) {
  const client = baseClient ?? new PrismaClient();

  return client.$extends({
    name: 'TenantIsolationAndSoftDelete',
    query: {
      $allModels: {
        async findMany({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          const isTenantScoped = TENANT_SCOPED_MODELS.has(model);
          const isSoftDelete = SOFT_DELETE_MODELS.has(model);

          if (isTenantScoped || isSoftDelete) {
            const coachingId = isTenantScoped ? RequestContextService.getCoachingId() : undefined;
            args.where = {
              ...args.where,
              ...(isSoftDelete ? { deletedAt: null } : {}),
              ...(coachingId ? { coachingId } : {}),
            };
          }
          return query(args);
        },

        async findFirst({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          const isTenantScoped = TENANT_SCOPED_MODELS.has(model);
          const isSoftDelete = SOFT_DELETE_MODELS.has(model);

          if (isTenantScoped || isSoftDelete) {
            const coachingId = isTenantScoped ? RequestContextService.getCoachingId() : undefined;
            args.where = {
              ...args.where,
              ...(isSoftDelete ? { deletedAt: null } : {}),
              ...(coachingId ? { coachingId } : {}),
            };
          }
          return query(args);
        },

        async findUnique({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          const isTenantScoped = TENANT_SCOPED_MODELS.has(model);
          const isSoftDelete = SOFT_DELETE_MODELS.has(model);

          if (isTenantScoped || isSoftDelete) {
            const coachingId = isTenantScoped ? RequestContextService.getCoachingId() : undefined;
            if ((coachingId || isSoftDelete) && args?.where) {
              const modifiedWhere = {
                ...args.where,
                ...(isSoftDelete ? { deletedAt: null } : {}),
                ...(coachingId ? { coachingId } : {}),
              };
              return (client as any)[model].findFirst({ where: modifiedWhere });
            }
          }
          return query(args);
        },

        async count({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          const isTenantScoped = TENANT_SCOPED_MODELS.has(model);
          const isSoftDelete = SOFT_DELETE_MODELS.has(model);

          if (isTenantScoped || isSoftDelete) {
            const coachingId = isTenantScoped ? RequestContextService.getCoachingId() : undefined;
            args.where = {
              ...args.where,
              ...(isSoftDelete ? { deletedAt: null } : {}),
              ...(coachingId ? { coachingId } : {}),
            };
          }
          return query(args);
        },

        async create({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          const isTenantScoped = TENANT_SCOPED_MODELS.has(model);
          const isAuditedCreate = AUDITED_CREATE_MODELS.has(model);

          if (isTenantScoped || isAuditedCreate) {
            const coachingId = isTenantScoped ? RequestContextService.getCoachingId() : undefined;
            const userId = isAuditedCreate ? RequestContextService.getUserId() : undefined;
            args.data = {
              ...args.data,
              ...(coachingId ? { coachingId } : {}),
              ...(userId ? { createdBy: userId } : {}),
            };
          }
          return query(args);
        },

        async createMany({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          const isTenantScoped = TENANT_SCOPED_MODELS.has(model);
          const isAuditedCreate = AUDITED_CREATE_MODELS.has(model);

          if (isTenantScoped || isAuditedCreate) {
            const coachingId = isTenantScoped ? RequestContextService.getCoachingId() : undefined;
            const userId = isAuditedCreate ? RequestContextService.getUserId() : undefined;

            if (Array.isArray(args.data)) {
              args.data = args.data.map((item: any) => ({
                ...item,
                ...(coachingId ? { coachingId } : {}),
                ...(userId ? { createdBy: userId } : {}),
              }));
            } else if (args.data) {
              args.data = {
                ...args.data,
                ...(coachingId ? { coachingId } : {}),
                ...(userId ? { createdBy: userId } : {}),
              };
            }
          }
          return query(args);
        },

        async update({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          const isTenantScoped = TENANT_SCOPED_MODELS.has(model);
          const isAuditedUpdate = AUDITED_UPDATE_MODELS.has(model);
          const isSoftDelete = SOFT_DELETE_MODELS.has(model);

          if (isTenantScoped || isAuditedUpdate) {
            const coachingId = isTenantScoped ? RequestContextService.getCoachingId() : undefined;
            const userId = isAuditedUpdate ? RequestContextService.getUserId() : undefined;

            if (coachingId && (client as any)[model]?.findFirst) {
              // Fail-closed security validation: verify record belongs to active tenant
              const existing = await (client as any)[model].findFirst({
                where: {
                  ...args.where,
                  coachingId,
                  ...(isSoftDelete ? { deletedAt: null } : {}),
                },
                select: { id: true },
              });

              if (!existing) {
                throw new Error(`[TenantPrisma] Access denied or record not found in ${model} for active tenant`);
              }
            }

            if (userId && args.data) {
              args.data.updatedBy = userId;
            }
          }
          return query(args);
        },

        async updateMany({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          const isTenantScoped = TENANT_SCOPED_MODELS.has(model);
          const isSoftDelete = SOFT_DELETE_MODELS.has(model);
          const isAuditedUpdate = AUDITED_UPDATE_MODELS.has(model);

          if (isTenantScoped || isSoftDelete) {
            const coachingId = isTenantScoped ? RequestContextService.getCoachingId() : undefined;
            const userId = isAuditedUpdate ? RequestContextService.getUserId() : undefined;

            args.where = {
              ...args.where,
              ...(isSoftDelete ? { deletedAt: null } : {}),
              ...(coachingId ? { coachingId } : {}),
            };

            if (userId && args.data) {
              args.data.updatedBy = userId;
            }
          }
          return query(args);
        },

        async delete({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          const isTenantScoped = TENANT_SCOPED_MODELS.has(model);
          const isAuditedUpdate = AUDITED_UPDATE_MODELS.has(model);
          const isSoftDelete = SOFT_DELETE_MODELS.has(model);

          if (isTenantScoped) {
            const coachingId = RequestContextService.getCoachingId();
            if (coachingId && (client as any)[model]?.findFirst) {
              const existing = await (client as any)[model].findFirst({
                where: {
                  ...args.where,
                  coachingId,
                  ...(isSoftDelete ? { deletedAt: null } : {}),
                },
                select: { id: true },
              });

              if (!existing) {
                throw new Error(`[TenantPrisma] Access denied or record not found in ${model} for active tenant`);
              }
            }
          }

          // Soft-delete interceptor: only for models that possess deletedAt column
          if (isSoftDelete) {
            const userId = isAuditedUpdate ? RequestContextService.getUserId() : undefined;

            logger.debug(`[PrismaMiddleware] Rewriting hard delete to soft delete for ${model}`, {
              where: args.where,
            });
            return (client as any)[model].update({
              where: args.where,
              data: {
                deletedAt: new Date(),
                ...(userId ? { updatedBy: userId } : {}),
              },
            });
          }
          return query(args);
        },

        async deleteMany({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          const isTenantScoped = TENANT_SCOPED_MODELS.has(model);
          const isSoftDelete = SOFT_DELETE_MODELS.has(model);
          const isAuditedUpdate = AUDITED_UPDATE_MODELS.has(model);

          if (isSoftDelete) {
            const coachingId = isTenantScoped ? RequestContextService.getCoachingId() : undefined;
            const userId = isAuditedUpdate ? RequestContextService.getUserId() : undefined;

            return (client as any)[model].updateMany({
              where: {
                ...args.where,
                deletedAt: null,
                ...(coachingId ? { coachingId } : {}),
              },
              data: {
                deletedAt: new Date(),
                ...(userId ? { updatedBy: userId } : {}),
              },
            });
          }

          if (isTenantScoped) {
            const coachingId = RequestContextService.getCoachingId();
            args.where = {
              ...args.where,
              ...(coachingId ? { coachingId } : {}),
            };
          }
          return query(args);
        },

        async upsert({ model, args, query }: { model: string; args: any; query: (args: any) => Promise<any> }) {
          const isTenantScoped = TENANT_SCOPED_MODELS.has(model);
          const isAuditedCreate = AUDITED_CREATE_MODELS.has(model);
          const isAuditedUpdate = AUDITED_UPDATE_MODELS.has(model);

          if (isTenantScoped || isAuditedCreate || isAuditedUpdate) {
            const coachingId = isTenantScoped ? RequestContextService.getCoachingId() : undefined;
            const userId = RequestContextService.getUserId();

            if (args.create) {
              args.create = {
                ...args.create,
                ...(coachingId ? { coachingId } : {}),
                ...(isAuditedCreate && userId ? { createdBy: userId } : {}),
              };
            }
            if (args.update) {
              args.update = {
                ...args.update,
                ...(isAuditedUpdate && userId ? { updatedBy: userId } : {}),
              };
            }
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

/**
 * Executes an action inside an interactive PostgreSQL transaction with the RLS session
 * variable (app.current_coaching_id) set, guaranteeing fail-closed RLS policy enforcement.
 */
export async function withTenantRlsContext<T>(
  coachingId: string,
  action: (prisma: ExtendedPrismaClient) => Promise<T>,
): Promise<T> {
  const client = getPrismaClient();
  return (client as any).$transaction(async (tx: any) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_coaching_id = '${coachingId}'`);
    return action(tx);
  });
}
