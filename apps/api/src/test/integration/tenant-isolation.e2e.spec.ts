import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import type { Express } from 'express';

/**
 * End-to-end tenant isolation through the real HTTP stack: registration and login (which run
 * as explicit system operations), then authenticated requests scoped by the JWT's coaching.
 *
 * Needs a migrated, RBAC-seeded database and Redis:
 *   DATABASE_URL             application role (the app under test connects with this)
 *   TEST_DATABASE_OWNER_URL  schema owner, used to reset fixtures
 *   REDIS_HOST / REDIS_PORT
 */
const OWNER_URL = process.env.TEST_DATABASE_OWNER_URL;
const enabled = !!OWNER_URL && !!process.env.TEST_DATABASE_URL;

const SHARED_OWNER_EMAIL = 'owner@shared-mail.in';
const PASSWORD = 'Str0ng!Passw0rd';

function registration(code: string) {
  return {
    coachingName: `Coaching ${code}`,
    phone: '9876543210',
    email: `${code}@institute.in`,
    ownerName: `Owner ${code}`,
    ownerEmail: SHARED_OWNER_EMAIL,
    ownerPhone: '9876543210',
    ownerPassword: PASSWORD,
  };
}

describe.skipIf(!enabled)('Tenant isolation end-to-end (HTTP + PostgreSQL)', () => {
  let app: Express;
  let owner: PrismaClient;
  let tokenA: string;
  let tokenB: string;
  let studentOfA: string;

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: OWNER_URL } } });
    await owner.$transaction([
      owner.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`,
      owner.$executeRawUnsafe('TRUNCATE coachings, refresh_tokens CASCADE'),
    ]);

    const { createApp } = await import('../../main.js');
    app = createApp();

    // The server makes each institute's code; sign in with the ones it returns
    const codes: string[] = [];
    for (const name of ['alpha-e2e', 'beta-e2e']) {
      const res = await request(app).post('/api/v1/coachings/register').send(registration(name));
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      codes.push(res.body.data.code);
    }

    const login = async (coachingCode: string) => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: SHARED_OWNER_EMAIL, password: PASSWORD, coachingCode });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      return res.body.data.tokens.accessToken as string;
    };
    tokenA = await login(codes[0]!);
    tokenB = await login(codes[1]!);
  }, 60_000);

  afterAll(async () => {
    await owner?.$disconnect();
    const { queueRegistry } = await import('../../queues/queue.registry.js');
    const { getPrismaClient } = await import('../../database/prisma/tenant-prisma.extension.js');
    await queueRegistry.closeAll().catch(() => undefined);
    await (getPrismaClient() as any).$disconnect();
  });

  it('refuses an ambiguous login when the email exists at two coachings', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: SHARED_OWNER_EMAIL, password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it('lets each owner work inside their own coaching', async () => {
    const created = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ firstName: 'Asha', lastName: 'Verma' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    studentOfA = created.body.data.id;

    const listA = await request(app).get('/api/v1/students').set('Authorization', `Bearer ${tokenA}`);
    expect(listA.status).toBe(200);
    expect(JSON.stringify(listA.body)).toContain(studentOfA);
  });

  it("hides one coaching's students from another", async () => {
    const listB = await request(app).get('/api/v1/students').set('Authorization', `Bearer ${tokenB}`);
    expect(listB.status).toBe(200);
    expect(JSON.stringify(listB.body)).not.toContain(studentOfA);

    const getB = await request(app).get(`/api/v1/students/${studentOfA}`).set('Authorization', `Bearer ${tokenB}`);
    expect(getB.status).toBe(404);
  });

  it("refuses to modify another coaching's student", async () => {
    const update = await request(app)
      .put(`/api/v1/students/${studentOfA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ firstName: 'Hacked' });
    expect(update.status).toBeGreaterThanOrEqual(400);

    const del = await request(app).delete(`/api/v1/students/${studentOfA}`).set('Authorization', `Bearer ${tokenB}`);
    expect(del.status).toBeGreaterThanOrEqual(400);

    const stillA = await request(app).get(`/api/v1/students/${studentOfA}`).set('Authorization', `Bearer ${tokenA}`);
    expect(stillA.status).toBe(200);
    expect(stillA.body.data.firstName).toBe('Asha');
  });
});
