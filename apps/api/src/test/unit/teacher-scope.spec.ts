import { describe, it, expect, vi, afterEach } from 'vitest';
import { RoleType } from '@vargly/types';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { taughtBatchScope } from '../../common/decorators/require-batch-access.decorator.js';
import * as prismaModule from '../../database/prisma/tenant-prisma.extension.js';
import { PrismaStudentRepository } from '../../modules/students/student.repository.js';
import { PrismaParentRepository } from '../../modules/parents/parent.repository.js';

afterEach(() => vi.restoreAllMocks());

function as<R>(roles: RoleType[], callback: () => R): R {
  return RequestContextService.run(
    { coachingId: 'c1', userId: 'u1', roles, traceId: 't' } as any,
    callback,
  );
}

describe('what a teacher may list', () => {
  it('leaves owners unlimited', async () => {
    expect(await as([RoleType.OWNER], () => taughtBatchScope())).toBeNull();
  });

  it("limits a teacher to their own batches, and to nothing when they teach none", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ teacherBatches: [{ batchId: 'b1' }, { batchId: 'b2' }] })
      .mockResolvedValueOnce(null);
    vi.spyOn(prismaModule, 'getPrismaClient').mockReturnValue({ teacher: { findFirst } } as any);

    expect(await as([RoleType.TEACHER], () => taughtBatchScope())).toEqual(['b1', 'b2']);
    expect(await as([RoleType.TEACHER], () => taughtBatchScope())).toEqual([]);
  });

  it('lists only students currently in those batches', async () => {
    let where: any;
    const prisma = { student: { findMany: async (args: any) => ((where = args.where), []) } };
    await new PrismaStudentRepository(prisma as any).findMany({ batchIds: ['b1'] });
    expect(where.batchStudents).toEqual({ some: { batchId: { in: ['b1'] }, leftAt: null } });
  });

  it("lists and opens only parents of those batches' students", async () => {
    const calls: any[] = [];
    const prisma = {
      parent: {
        findMany: async (args: any) => (calls.push(args.where), []),
        findFirst: async (args: any) => (calls.push(args.where), null),
      },
    };
    const repo = new PrismaParentRepository(prisma as any);
    await repo.findMany(undefined, ['b1']);
    await repo.findById('p1', ['b1']);
    await repo.findMany();

    const scoped = {
      some: { student: { batchStudents: { some: { batchId: { in: ['b1'] }, leftAt: null } } } },
    };
    expect(calls[0].studentParents).toEqual(scoped);
    expect(calls[1]).toMatchObject({ id: 'p1', studentParents: scoped });
    // Owners: no batch condition at all
    expect(calls[2].studentParents).toBeUndefined();
  });
});
