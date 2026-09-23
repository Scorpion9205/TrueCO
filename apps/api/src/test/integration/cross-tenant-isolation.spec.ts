import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { RequestContextService } from '../../common/services/request-context.service.js';
import {
  createTenantPrismaClient,
  CrossTenantAccessError,
  ExtendedPrismaClient,
  TenantContextMissingError,
} from '../../database/prisma/tenant-prisma.extension.js';
import { assertDatabaseRoleEnforcesRls } from '../../database/prisma/database-role.check.js';
import { envConfig } from '../../config/env.config.js';

/**
 * Non-negotiable phase gate: proves tenants cannot read or write each other's data, at both
 * the application layer (Prisma tenant extension) and the database layer (PostgreSQL RLS).
 *
 * Runs against a real, migrated PostgreSQL database:
 *   TEST_DATABASE_OWNER_URL  schema owner, used for fixtures
 *   TEST_DATABASE_URL        ordinary application role (see infra/docker/postgres/create-app-role.sql)
 */
const APP_URL = process.env.TEST_DATABASE_URL;
const OWNER_URL = process.env.TEST_DATABASE_OWNER_URL;

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const STUDENT_A = 'aaaaaaaa-1111-4000-8000-000000000001';
const STUDENT_B = 'bbbbbbbb-1111-4000-8000-000000000002';
const BATCH_A = 'aaaaaaaa-2222-4000-8000-000000000001';

const asA = <T>(fn: () => T) => RequestContextService.runForTenant(A, fn);
const asSystem = <T>(fn: () => T) => RequestContextService.runAsSystem('test', fn);

describe.skipIf(!APP_URL || !OWNER_URL)('Cross-tenant isolation (real PostgreSQL)', () => {
  let owner: PrismaClient;
  let appBase: PrismaClient;
  let db: ExtendedPrismaClient;

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: OWNER_URL } } });
    appBase = new PrismaClient({ datasources: { db: { url: APP_URL } } });
    db = createTenantPrismaClient(appBase);
  });

  beforeEach(async () => {
    await owner.$transaction([
      owner.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`,
      owner.$executeRawUnsafe('TRUNCATE coachings CASCADE'),
      owner.coaching.createMany({
        data: [
          { id: A, name: 'Alpha Classes', code: 'ALPHA', phone: '1', email: 'a@alpha.in' },
          { id: B, name: 'Beta Academy', code: 'BETA', phone: '2', email: 'b@beta.in' },
        ],
      }),
      owner.student.createMany({
        data: [
          { id: STUDENT_A, coachingId: A, firstName: 'Asha', lastName: 'A' },
          { id: STUDENT_B, coachingId: B, firstName: 'Bala', lastName: 'B' },
        ],
      }),
      owner.batch.create({ data: { id: BATCH_A, coachingId: A, name: 'Maths', academicYear: '2026' } }),
      owner.batchStudent.create({ data: { coachingId: A, batchId: BATCH_A, studentId: STUDENT_A } }),
    ]);
  });

  afterAll(async () => {
    await owner?.$disconnect();
    await appBase?.$disconnect();
  });

  const nameOfStudentB = async () =>
    (
      await owner.$transaction([
        owner.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`,
        owner.student.findUnique({ where: { id: STUDENT_B } }),
      ])
    )[1];

  describe('application layer (tenant extension)', () => {
    it('refuses tenant-scoped queries with no tenant in context', async () => {
      await expect((db as any).student.findMany()).rejects.toBeInstanceOf(TenantContextMissingError);
      await expect((db as any).student.count()).rejects.toBeInstanceOf(TenantContextMissingError);
    });

    it('confines every read operation to the active tenant', async () => {
      await asA(async () => {
        const all = await (db as any).student.findMany();
        expect(all.map((s: any) => s.id)).toEqual([STUDENT_A]);

        expect(await (db as any).student.findUnique({ where: { id: STUDENT_B } })).toBeNull();
        expect(await (db as any).student.findFirst({ where: { id: STUDENT_B } })).toBeNull();
        await expect((db as any).student.findUniqueOrThrow({ where: { id: STUDENT_B } })).rejects.toThrow();
        await expect((db as any).student.findFirstOrThrow({ where: { id: STUDENT_B } })).rejects.toThrow();

        expect(await (db as any).student.count()).toBe(1);
        const agg = await (db as any).student.aggregate({ _count: { _all: true } });
        expect(agg._count._all).toBe(1);
        const groups = await (db as any).student.groupBy({ by: ['coachingId'], _count: { _all: true } });
        expect(groups).toEqual([{ coachingId: A, _count: { _all: 1 } }]);
      });
    });

    it('keeps select/include on findUnique (regression: rewrite dropped them)', async () => {
      await asA(async () => {
        const student = await (db as any).student.findUnique({
          where: { id: STUDENT_A },
          include: { batchStudents: true },
        });
        expect(student.batchStudents).toHaveLength(1);

        const picked = await (db as any).student.findUnique({ where: { id: STUDENT_A }, select: { firstName: true } });
        expect(picked).toEqual({ firstName: 'Asha' });
      });
    });

    it('cannot update, upsert or delete another tenant\'s rows', async () => {
      await asA(async () => {
        await expect(
          (db as any).student.update({ where: { id: STUDENT_B }, data: { firstName: 'Hacked' } }),
        ).rejects.toThrow();

        const many = await (db as any).student.updateMany({ where: { id: STUDENT_B }, data: { firstName: 'Hacked' } });
        expect(many.count).toBe(0);

        // Upsert must not overwrite B's row; at worst it creates a new row inside tenant A
        await (db as any).student.upsert({
          where: { id: STUDENT_B },
          create: { firstName: 'New', lastName: 'InA' },
          update: { firstName: 'Hacked' },
        });

        await expect((db as any).student.delete({ where: { id: STUDENT_B } })).rejects.toThrow();
        const deleted = await (db as any).student.deleteMany({ where: { id: STUDENT_B } });
        expect(deleted.count).toBe(0);
      });

      const b = await nameOfStudentB();
      expect(b?.firstName).toBe('Bala');
      expect(b?.deletedAt).toBeNull();
    });

    it('refuses writes that name a different coachingId', async () => {
      await asA(async () => {
        await expect(
          (db as any).student.create({ data: { coachingId: B, firstName: 'X', lastName: 'Y' } }),
        ).rejects.toBeInstanceOf(CrossTenantAccessError);
        await expect(
          (db as any).student.update({ where: { id: STUDENT_A }, data: { coachingId: B } }),
        ).rejects.toBeInstanceOf(CrossTenantAccessError);
        await expect((db as any).student.findMany({ where: { coachingId: B } })).rejects.toBeInstanceOf(
          CrossTenantAccessError,
        );
      });
    });

    it('stamps coachingId on create and soft-deletes within the tenant', async () => {
      await asA(async () => {
        const created = await (db as any).student.create({ data: { firstName: 'Chitra', lastName: 'A' } });
        expect(created.coachingId).toBe(A);

        await (db as any).student.delete({ where: { id: created.id } });
        expect(await (db as any).student.findUnique({ where: { id: created.id } })).toBeNull();
        const stillThere = await (db as any).student.findFirst({ where: { id: created.id, deletedAt: { not: null } } });
        expect(stillThere?.deletedAt).toBeInstanceOf(Date);
      });
    });

    it('lets explicit system operations see every tenant', async () => {
      const ids = await asSystem(() => (db as any).student.findMany({ orderBy: { firstName: 'asc' } }));
      expect(ids.map((s: any) => s.id)).toEqual([STUDENT_A, STUDENT_B]);
    });
  });

  describe('database layer (row-level security)', () => {
    it('returns no tenant rows to the app role when no tenant is set', async () => {
      expect(await appBase.student.findMany()).toEqual([]);
      const [{ n }] = await appBase.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int AS n FROM students`;
      expect(n).toBe(0);
    });

    it('confines raw SQL, which the extension cannot rewrite, to the active tenant', async () => {
      const rows = await asA(() => (db as any).$queryRaw`SELECT id FROM students ORDER BY id`);
      expect(rows.map((r: any) => r.id)).toEqual([STUDENT_A]);
    });

    it('rejects a raw insert into another tenant', async () => {
      await expect(
        asA(
          () =>
            (db as any).$executeRaw`INSERT INTO students (id, coaching_id, first_name, last_name, updated_at)
              VALUES (gen_random_uuid(), ${B}::uuid, 'Sneaky', 'Insert', now())`,
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  describe('interactive transactions', () => {
    it('stay atomic: a thrown error rolls back writes made inside', async () => {
      await expect(
        asA(() =>
          (db as any).$transaction(async (tx: any) => {
            await tx.student.update({ where: { id: STUDENT_A }, data: { firstName: 'Rolled' } });
            throw new Error('abort');
          }),
        ),
      ).rejects.toThrow('abort');

      const a = await asA(() => (db as any).student.findUnique({ where: { id: STUDENT_A } }));
      expect(a.firstName).toBe('Asha');
    });

    it('are tenant-scoped at both layers inside the transaction', async () => {
      const result = await asA(() =>
        (db as any).$transaction(async (tx: any) => ({
          viaModel: (await tx.student.findMany()).map((s: any) => s.id),
          viaRaw: (await tx.$queryRaw`SELECT id FROM students`).map((r: any) => r.id),
        })),
      );
      expect(result).toEqual({ viaModel: [STUDENT_A], viaRaw: [STUDENT_A] });
    });
  });

  describe('database role check', () => {
    it('accepts the application role', async () => {
      await expect(assertDatabaseRoleEnforcesRls(db)).resolves.toBeUndefined();
    });

    it('refuses a role that bypasses RLS in production', async () => {
      const ownerDb = createTenantPrismaClient(owner);
      const isSuperuser = (await owner.$queryRaw<Array<{ s: boolean }>>`SELECT rolsuper AS s FROM pg_roles WHERE rolname = current_user`)[0].s;
      if (!isSuperuser) return;

      const realGet = envConfig.get.bind(envConfig);
      vi.spyOn(envConfig, 'get').mockImplementation(((key: string) =>
        key === 'NODE_ENV' ? 'production' : realGet(key as any)) as any);
      try {
        await expect(assertDatabaseRoleEnforcesRls(ownerDb)).rejects.toThrow(/row-level security is not enforced/);
      } finally {
        vi.restoreAllMocks();
      }
    });
  });
});
