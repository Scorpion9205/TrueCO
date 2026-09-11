import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { StatusCodes } from 'http-status-codes';
import { envConfig } from './config/env.config.js';
import { logger } from './common/logger/logger.service.js';
import { tenantContextMiddleware } from './common/middleware/tenant-context.middleware.js';
import { errorHandlerMiddleware } from './common/middleware/error-handler.middleware.js';
import { queueRegistry } from './queues/queue.registry.js';
import { getPrismaClient } from './database/prisma/tenant-prisma.extension.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { RbacModule } from './modules/rbac/rbac.module.js';
import { CoachingModule } from './modules/coaching/coaching.module.js';
import { StudentModule } from './modules/students/student.module.js';
import { ParentModule } from './modules/parents/parent.module.js';
import { TeacherModule } from './modules/teachers/teacher.module.js';
import { BatchModule } from './modules/batches/batch.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { TestModule } from './modules/tests/test.module.js';
import { HomeworkModule } from './modules/homework/homework.module.js';
import { NotificationModule } from './modules/notifications/notification.module.js';
import { TimelineModule } from './modules/timeline/timeline.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { FeeModule } from './modules/fees/fee.module.js';
import { SalaryModule } from './modules/salary/salary.module.js';
import { ExpenseModule } from './modules/expenses/expense.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { NoticeModule } from './modules/notice-board/notice.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { ReportModule } from './modules/reports/report.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { ImportModule } from './modules/import/import.module.js';
import { WhatsAppAssistantModule } from './modules/whatsapp-assistant/whatsapp-assistant.module.js';
import { RiskEngineModule } from './modules/risk-engine/risk-engine.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { workerRegistry } from './workers/worker.registry.js';

export function createApp(): Express {
  const app = express();

  // Security & Transport
  app.use(helmet());
  app.use(
    cors({
      origin: envConfig.get('CORS_ORIGIN'),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request Context & Multi-Tenancy
  app.use(tenantContextMiddleware);

  // Health Checks
  app.get('/health/live', (_req: Request, res: Response) => {
    res.status(StatusCodes.OK).json({
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (_req: Request, res: Response) => {
    try {
      // 1. Check Redis
      const redis = queueRegistry.getRedisClient();
      const redisPing = await redis.ping();

      // 2. Check Database
      const prisma = getPrismaClient();
      await (prisma as any).$queryRaw`SELECT 1`;

      res.status(StatusCodes.OK).json({
        status: 'READY',
        checks: {
          database: 'UP',
          redis: redisPing === 'PONG' ? 'UP' : 'DOWN',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error('Readiness check failed:', err);
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        status: 'DOWN',
        error: (err as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Base API v1 placeholder
  app.get('/api/v1', (_req: Request, res: Response) => {
    res.status(StatusCodes.OK).json({
      name: 'TrueCO API',
      version: '1.0.0',
      status: 'OPERATIONAL',
      docs: '/api/v1/docs',
    });
  });

  // Domain Module Routes (Phase 1: Identity, Tenancy & Security)
  const authModule = AuthModule.init();
  const rbacModule = RbacModule.init();
  const coachingModule = CoachingModule.init();

  app.use('/api/v1/auth', authModule.router);
  app.use('/api/v1/rbac', rbacModule.router);
  app.use('/api/v1/coachings', coachingModule.router);

  // Domain Module Routes (Phase 2: Core Academic Domain)
  const studentModule = StudentModule.init();
  const parentModule = ParentModule.init();
  const teacherModule = TeacherModule.init();
  const batchModule = BatchModule.init();
  const attendanceModule = AttendanceModule.init();
  const testModule = TestModule.init();
  const homeworkModule = HomeworkModule.init();

  app.use('/api/v1/students', studentModule.router);
  app.use('/api/v1/parents', parentModule.router);
  app.use('/api/v1/teachers', teacherModule.router);
  app.use('/api/v1/batches', batchModule.router);
  app.use('/api/v1/attendance', attendanceModule.router);
  app.use('/api/v1/tests', testModule.router);
  app.use('/api/v1/homework', homeworkModule.router);

  // Domain Module Routes (Phase 3: Notifications, Timeline & Audit)
  const notificationModule = NotificationModule.init();
  const timelineModule = TimelineModule.init();
  const auditModule = AuditModule.init();

  app.use('/api/v1/notifications', notificationModule.router);
  app.use('/api/v1/timeline', timelineModule.router);
  app.use('/api/v1/audit', auditModule.router);

  // Domain Module Routes (Phase 4: Fees, Salary, Expenses & Billing)
  const feeModule = FeeModule.init();
  const salaryModule = SalaryModule.init();
  const expenseModule = ExpenseModule.init();
  const billingModule = BillingModule.init();

  app.use('/api/v1/fees', feeModule.router);
  app.use('/api/v1/salary', salaryModule.router);
  app.use('/api/v1/expenses', expenseModule.router);
  app.use('/api/v1/billing', billingModule.router);

  // Domain Module Routes (Phase 5: Reports, Notice Board, Settings & Import)
  const noticeModule = NoticeModule.init();
  const settingsModule = SettingsModule.init();
  const reportModule = ReportModule.init();
  const dashboardModule = DashboardModule.init();
  const importModule = ImportModule.init();

  app.use('/api/v1/notices', noticeModule.router);
  app.use('/api/v1/settings', settingsModule.router);
  app.use('/api/v1/reports', reportModule.router);
  app.use('/api/v1/dashboard', dashboardModule.router);
  app.use('/api/v1/import', importModule.router);

  // Domain Module Routes (Phase 6: Smart WhatsApp Assistant & Student Risk Engine)
  const whatsappAssistantModule = WhatsAppAssistantModule.init();
  const riskEngineModule = RiskEngineModule.init();

  app.use('/api/v1/whatsapp-assistant', whatsappAssistantModule.router);
  app.use('/api/v1/risk-engine', riskEngineModule.router);

  // Domain Module Routes (Phase 7: AI Service Layer - Premium)
  const aiModule = AiModule.init();
  app.use('/api/v1/ai', aiModule.router);

  // Global Error Handler (must be last)
  app.use(errorHandlerMiddleware);

  return app;
}

async function startServer(): Promise<void> {
  const app = createApp();
  const port = envConfig.get('PORT');

  // Start background queue workers in non-test environments
  if (envConfig.get('NODE_ENV') !== 'test') {
    workerRegistry.startAll();
  }

  const server = app.listen(port, () => {
    logger.info(`🚀 TrueCO API server running on port ${port} [${envConfig.get('NODE_ENV')}]`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`[Server] Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      try {
        await workerRegistry.closeAll();
        await queueRegistry.closeAll();
        const prisma = getPrismaClient();
        await (prisma as any).$disconnect();
        logger.info('[Server] Graceful shutdown completed.');
        process.exit(0);
      } catch (err) {
        logger.error('[Server] Error during graceful shutdown:', err);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Auto-start server if executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    logger.error('Failed to start TrueCO API server:', err);
    process.exit(1);
  });
}
