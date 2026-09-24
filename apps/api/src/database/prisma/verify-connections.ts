import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';

interface CheckResult {
  component: string;
  status: 'CONNECTED' | 'FAILED';
  details: Record<string, any>;
  latencyMs: number;
}

async function testPrismaAndDatabase(): Promise<CheckResult> {
  const start = Date.now();
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'postgresql://trueco_user:trueco_password@localhost:5432/trueco_db?schema=public',
      },
    },
  });

  try {
    // 1. Raw SQL ping
    const rawResult = await prisma.$queryRaw<Array<{ connected: number; version: string; current_database: string; current_user: string }>>`
      SELECT 1 as connected, version(), current_database(), current_user;
    `;

    // 2. Prisma ORM queries
    const permissionsCount = await prisma.permission.count();
    const roles = await prisma.role.findMany({ select: { name: true, code: true, isSystem: true } });
    const plans = await prisma.plan.findMany({ select: { code: true, name: true, priceMonthly: true } });
    const coachingsCount = await prisma.coaching.count();
    const studentsCount = await prisma.student.count();

    await prisma.$disconnect();

    return {
      component: 'PostgreSQL Database & Prisma ORM',
      status: 'CONNECTED',
      latencyMs: Date.now() - start,
      details: {
        database: rawResult[0]?.current_database,
        user: rawResult[0]?.current_user,
        serverVersion: rawResult[0]?.version.split(' ')[0] + ' ' + rawResult[0]?.version.split(' ')[1],
        permissionsCount,
        roles: roles.map((r: any) => `${r.name} (${r.code})`),
        plans: plans.map((p: any) => `${p.name} (INR ${p.priceMonthly})`),
        existingCoachings: coachingsCount,
        existingStudents: studentsCount,
      },
    };
  } catch (error: any) {
    await prisma.$disconnect().catch(() => {});
    return {
      component: 'PostgreSQL Database & Prisma ORM',
      status: 'FAILED',
      latencyMs: Date.now() - start,
      details: { error: error.message },
    };
  }
}

async function testRedis(): Promise<CheckResult> {
  const start = Date.now();
  const redis = new Redis({
    host: 'localhost',
    port: 6379,
    lazyConnect: true,
    connectTimeout: 4000,
  });

  try {
    await redis.connect();
    const pingResponse = await redis.ping();

    // Round-trip test key
    const testKey = 'trueco:diagnostic:ping';
    const testValue = `ok-${Date.now()}`;
    await redis.set(testKey, testValue, 'EX', 10);
    const readValue = await redis.get(testKey);
    await redis.del(testKey);

    const info = await redis.info('server');
    const versionMatch = info.match(/redis_version:([^\r\n]+)/);
    const uptimeMatch = info.match(/uptime_in_seconds:([^\r\n]+)/);

    await redis.quit();

    return {
      component: 'Redis In-Memory Cache & Broker',
      status: 'CONNECTED',
      latencyMs: Date.now() - start,
      details: {
        ping: pingResponse,
        readWriteRoundtrip: readValue === testValue ? 'SUCCESS' : 'MISMATCH',
        redisVersion: versionMatch ? versionMatch[1] : 'unknown',
        uptimeSeconds: uptimeMatch ? Number(uptimeMatch[1]) : 'unknown',
      },
    };
  } catch (error: any) {
    await redis.quit().catch(() => {});
    return {
      component: 'Redis In-Memory Cache & Broker',
      status: 'FAILED',
      latencyMs: Date.now() - start,
      details: { error: error.message },
    };
  }
}

async function testBullMQ(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const queuesToCheck = ['whatsapp-queue', 'email-queue', 'ai-queue'];
    const queueStats: Record<string, any> = {};

    for (const qName of queuesToCheck) {
      const q = new Queue(qName, {
        connection: { host: 'localhost', port: 6379 },
      });
      const counts = await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      const isPaused = await q.isPaused();
      queueStats[qName] = { counts, isPaused };
      await q.close();
    }

    // Check BullMQ Dashboard HTTP endpoint
    let bullBoardStatus = 'UNREACHABLE';
    try {
      const boardRes = await fetch('http://localhost:3001');
      bullBoardStatus = boardRes.status === 200 ? 'HTTP 200 OK' : `HTTP ${boardRes.status}`;
    } catch (e: any) {
      bullBoardStatus = `FAILED (${e.message})`;
    }

    return {
      component: 'BullMQ Queues & Dashboard',
      status: 'CONNECTED',
      latencyMs: Date.now() - start,
      details: {
        queues: queueStats,
        dashboardUrl: 'http://localhost:3001',
        dashboardStatus: bullBoardStatus,
      },
    };
  } catch (error: any) {
    return {
      component: 'BullMQ Queues & Dashboard',
      status: 'FAILED',
      latencyMs: Date.now() - start,
      details: { error: error.message },
    };
  }
}

async function testBackendApi(): Promise<CheckResult> {
  const start = Date.now();
  try {
    // 1. Health check
    const healthRes = await fetch('http://localhost:4000/api/v1');
    const healthJson = await healthRes.json();

    // 2. CORS Preflight / Options check
    const corsRes = await fetch('http://localhost:4000/api/v1/auth/login', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });

    const corsOrigin = corsRes.headers.get('access-control-allow-origin');
    const corsMethods = corsRes.headers.get('access-control-allow-methods');
    const corsCredentials = corsRes.headers.get('access-control-allow-credentials');

    return {
      component: 'Backend API Server (Express :4000)',
      status: 'CONNECTED',
      latencyMs: Date.now() - start,
      details: {
        endpoint: 'http://localhost:4000/api/v1',
        healthResponse: healthJson,
        corsHeaders: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': corsMethods,
          'Access-Control-Allow-Credentials': corsCredentials,
        },
        corsValidForFrontend: corsOrigin === 'http://localhost:3000' || corsOrigin === '*',
      },
    };
  } catch (error: any) {
    return {
      component: 'Backend API Server (Express :4000)',
      status: 'FAILED',
      latencyMs: Date.now() - start,
      details: { error: error.message },
    };
  }
}

async function testFrontendApp(): Promise<CheckResult> {
  const start = Date.now();
  try {
    // 1. Check root page
    const rootRes = await fetch('http://localhost:3000');
    // 2. Check login page
    const loginRes = await fetch('http://localhost:3000/login');

    return {
      component: 'Frontend Web Application (Next.js :3000)',
      status: 'CONNECTED',
      latencyMs: Date.now() - start,
      details: {
        rootStatus: `HTTP ${rootRes.status}`,
        loginStatus: `HTTP ${loginRes.status}`,
        configuredApiUrl: 'http://localhost:4000/api/v1',
      },
    };
  } catch (error: any) {
    return {
      component: 'Frontend Web Application (Next.js :3000)',
      status: 'FAILED',
      latencyMs: Date.now() - start,
      details: { error: error.message },
    };
  }
}

async function runDiagnostic() {
  console.log('\n======================================================');
  console.log('   TrueCO Full-Stack Infrastructure & Connection Check');
  console.log('======================================================\n');

  const results: CheckResult[] = [
    await testPrismaAndDatabase(),
    await testRedis(),
    await testBullMQ(),
    await testBackendApi(),
    await testFrontendApp(),
  ];

  let allPassed = true;

  for (const res of results) {
    const mark = res.status === 'CONNECTED' ? '✅' : '❌';
    console.log(`${mark} [${res.status}] ${res.component} (${res.latencyMs}ms)`);
    console.log('   Details:', JSON.stringify(res.details, null, 2).replace(/\n/g, '\n   '));
    console.log('');
    if (res.status !== 'CONNECTED') {
      allPassed = false;
    }
  }

  console.log('======================================================');
  if (allPassed) {
    console.log('🎉 ALL 5 INTEGRATIONS & CONNECTIONS ARE VERIFIED LIVE!');
  } else {
    console.log('⚠️ ONE OR MORE CONNECTIONS FAILED. REVIEW ABOVE.');
  }
  console.log('======================================================\n');
}

runDiagnostic().catch((err) => {
  console.error(err);
  process.exit(1);
});
