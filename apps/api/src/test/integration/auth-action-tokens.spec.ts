import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createTenantPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { PrismaAuthActionTokenRepository } from '../../modules/auth/auth.repository.js';

/**
 * Single-use guarantee for password reset / email verification tokens against a real database:
 * concurrent attempts to use one token must succeed exactly once.
 */
const APP_URL = process.env.TEST_DATABASE_URL;
const OWNER_URL = process.env.TEST_DATABASE_OWNER_URL;

const COACHING = 'cccccccc-0000-4000-8000-000000000003';
const USER = 'cccccccc-1111-4000-8000-000000000003';

describe.skipIf(!APP_URL || !OWNER_URL)('Auth action tokens (real PostgreSQL)', () => {
  let owner: PrismaClient;
  let appBase: PrismaClient;
  let repo: PrismaAuthActionTokenRepository;

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: OWNER_URL } } });
    appBase = new PrismaClient({ datasources: { db: { url: APP_URL } } });
    repo = new PrismaAuthActionTokenRepository(createTenantPrismaClient(appBase));

    await owner.$transaction([
      owner.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`,
      owner.$executeRawUnsafe(`DELETE FROM auth_action_tokens WHERE user_id = '${USER}'`),
      owner.$executeRawUnsafe(`DELETE FROM users WHERE id = '${USER}'`),
      owner.$executeRawUnsafe(`DELETE FROM coachings WHERE id = '${COACHING}'`),
      owner.coaching.create({ data: { id: COACHING, name: 'Token Co', code: 'token-co', phone: '1', email: 't@t.in' } }),
      owner.user.create({
        data: { id: USER, coachingId: COACHING, name: 'U', email: 'u@t.in', phone: '1', passwordHash: 'x' },
      }),
    ]);
  });

  afterAll(async () => {
    await owner?.$disconnect();
    await appBase?.$disconnect();
  });

  it('lets exactly one of many concurrent attempts consume a token', async () => {
    await repo.issue(USER, 'PASSWORD_RESET', 'hash-concurrent', new Date(Date.now() + 60_000));

    const results = await Promise.all(Array.from({ length: 8 }, () => repo.consume('hash-concurrent', 'PASSWORD_RESET')));
    expect(results.filter((r) => r === USER)).toHaveLength(1);
    expect(results.filter((r) => r === null)).toHaveLength(7);
  });

  it('retires earlier unused tokens when a new one is issued', async () => {
    await repo.issue(USER, 'PASSWORD_RESET', 'hash-old', new Date(Date.now() + 60_000));
    await repo.issue(USER, 'PASSWORD_RESET', 'hash-new', new Date(Date.now() + 60_000));

    expect(await repo.consume('hash-old', 'PASSWORD_RESET')).toBeNull();
    expect(await repo.consume('hash-new', 'PASSWORD_RESET')).toBe(USER);
  });

  it('rejects expired tokens and tokens used for the wrong purpose', async () => {
    await repo.issue(USER, 'EMAIL_VERIFICATION', 'hash-expired', new Date(Date.now() - 1000));
    expect(await repo.consume('hash-expired', 'EMAIL_VERIFICATION')).toBeNull();

    await repo.issue(USER, 'EMAIL_VERIFICATION', 'hash-verify', new Date(Date.now() + 60_000));
    expect(await repo.consume('hash-verify', 'PASSWORD_RESET')).toBeNull();
    expect(await repo.consume('hash-verify', 'EMAIL_VERIFICATION')).toBe(USER);
  });
});
