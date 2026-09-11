import { describe, it, expect, beforeEach } from 'vitest';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { createTenantPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { RoleType } from '@trueco/types';

describe('Cross-Tenant Isolation Security Test (Non-Negotiable Phase Gate)', () => {
  const coachingA = '11111111-1111-1111-1111-111111111111';
  const coachingB = '22222222-2222-2222-2222-222222222222';

  let executedQueries: Array<{ model: string; where?: any; data?: any }> = [];
  let mockRawPrisma: any;
  let tenantPrisma: any;

  beforeEach(() => {
    executedQueries = [];

    // Mock Base Prisma Client with $extends capability
    mockRawPrisma = {
      $extends: (extensionConfig: any) => {
        const queryInterceptors = extensionConfig.query.$allModels;

        return {
          student: {
            findMany: async (args: any = {}) => {
              return queryInterceptors.findMany({
                model: 'Student',
                args,
                query: async (finalArgs: any) => {
                  executedQueries.push({ model: 'Student', where: finalArgs?.where });
                  return [];
                },
              });
            },
            findFirst: async (args: any = {}) => {
              return queryInterceptors.findFirst({
                model: 'Student',
                args,
                query: async (finalArgs: any) => {
                  executedQueries.push({ model: 'Student', where: finalArgs?.where });
                  return null;
                },
              });
            },
          },
          user: {
            create: async (args: any = {}) => {
              return queryInterceptors.create({
                model: 'User',
                args,
                query: async (finalArgs: any) => {
                  executedQueries.push({ model: 'User', data: finalArgs?.data });
                  return { id: 'created-id', ...finalArgs?.data };
                },
              });
            },
            update: async (args: any = {}) => {
              return queryInterceptors.update({
                model: 'User',
                args,
                query: async (finalArgs: any) => {
                  executedQueries.push({ model: 'User', where: finalArgs?.where, data: finalArgs?.data });
                  return { id: 'updated-id', ...finalArgs?.data };
                },
              });
            },
          },
        };
      },
    };

    tenantPrisma = createTenantPrismaClient(mockRawPrisma as any);
  });

  it('MUST automatically inject coachingId filter when Tenant A performs a query', async () => {
    await RequestContextService.run(
      {
        coachingId: coachingA,
        userId: 'user-a',
        roles: [RoleType.OWNER],
        permissions: ['students:read'],
        traceId: 'trace-a',
        features: [],
      },
      async () => {
        await tenantPrisma.student.findMany({ where: { gender: 'FEMALE' } });
      },
    );

    expect(executedQueries.length).toBe(1);
    const query = executedQueries[0];
    expect(query.model).toBe('Student');
    expect(query.where.coachingId).toBe(coachingA);
    expect(query.where.deletedAt).toBeNull();
    expect(query.where.gender).toBe('FEMALE');
  });

  it('MUST prevent Tenant A from querying Tenant B data even if Tenant B ID is passed in query', async () => {
    await RequestContextService.run(
      {
        coachingId: coachingA,
        userId: 'malicious-user-a',
        roles: [RoleType.TEACHER],
        permissions: ['students:read'],
        traceId: 'trace-attack',
        features: [],
      },
      async () => {
        // Malicious actor in Coaching A attempts to query Coaching B students
        await tenantPrisma.student.findMany({ where: { coachingId: coachingB } });
      },
    );

    expect(executedQueries.length).toBe(1);
    const query = executedQueries[0];
    // Enforced tenant context replaces/guarantees query stays in coachingA
    expect(query.where.coachingId).toBe(coachingA);
    expect(query.where.coachingId).not.toBe(coachingB);
  });

  it('MUST inject coachingId on create operations to prevent inserting data into another tenant', async () => {
    await RequestContextService.run(
      {
        coachingId: coachingA,
        userId: 'user-a',
        roles: [RoleType.OWNER],
        permissions: ['users:create'],
        traceId: 'trace-create',
        features: [],
      },
      async () => {
        // Attacker attempts to create a user under Coaching B
        await tenantPrisma.user.create({
          data: {
            name: 'Injected User',
            email: 'injected@test.com',
            coachingId: coachingB, // Malicious override
          },
        });
      },
    );

    expect(executedQueries.length).toBe(1);
    const createOp = executedQueries[0];
    expect(createOp.data.coachingId).toBe(coachingA); // Overwritten by context
    expect(createOp.data.createdBy).toBe('user-a');
  });

  it('MUST enforce soft delete filter on read queries so deleted records are hidden', async () => {
    await RequestContextService.run(
      {
        coachingId: coachingA,
        userId: 'user-a',
        roles: [RoleType.OWNER],
        permissions: ['students:read'],
        traceId: 'trace-soft-delete',
        features: [],
      },
      async () => {
        await tenantPrisma.student.findFirst();
      },
    );

    expect(executedQueries.length).toBe(1);
    const query = executedQueries[0];
    expect(query.where.deletedAt).toBeNull();
  });
});
