import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { envConfig } from '../../config/env.config.js';
import { safeEqual } from '../security/webhook-signature.js';
import { logger } from '../logger/logger.service.js';

// Enable default runtime & process metrics (CPU, Memory, Event Loop, Heap)
client.collectDefaultMetrics({
  prefix: 'vargly_',
});

export const httpRequestsTotal = new client.Counter({
  name: 'vargly_http_requests_total',
  help: 'Total number of incoming HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'vargly_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const bullMqJobsProcessedTotal = new client.Counter({
  name: 'vargly_bullmq_jobs_processed_total',
  help: 'Total number of BullMQ background jobs processed',
  labelNames: ['queue', 'status'],
});

/** Money was taken but could not be applied; someone must reconcile or refund it. Alert on any increase. */
export const paymentReconcileTotal = new client.Counter({
  name: 'vargly_payment_reconcile_total',
  help: 'Payments that were received but could not be applied and need manual reconciliation',
  labelNames: ['source', 'reason'],
});

// ---- Alerting gauges, read from the database when Prometheus scrapes (cached briefly)

const SCRAPE_CACHE_MS = 15_000;
let cachedAt = 0;
let cached: { events: Record<string, number>; failedNotifications24h: number } | null = null;

async function loadOperationalCounts() {
  if (cached && Date.now() - cachedAt < SCRAPE_CACHE_MS) return cached;
  // Imported lazily: the metrics module loads before the database layer
  const { getPrismaClient } = await import('../../database/prisma/tenant-prisma.extension.js');
  const { RequestContextService } = await import('../services/request-context.service.js');
  const db = getPrismaClient() as any;

  const [eventRows, notificationRows] = await RequestContextService.runAsSystem('metrics:scrape', () =>
    Promise.all([
      db.$queryRaw`SELECT status::text AS status, count(*)::int AS n FROM domain_events
                   WHERE status IN ('PENDING', 'FAILED', 'DEAD') GROUP BY status`,
      db.$queryRaw`SELECT count(*)::int AS n FROM notification_history
                   WHERE status = 'FAILED' AND updated_at > now() - interval '24 hours'`,
    ]),
  );
  const events: Record<string, number> = { PENDING: 0, FAILED: 0, DEAD: 0 };
  for (const row of eventRows as Array<{ status: string; n: number }>) events[row.status] = row.n;
  cached = { events, failedNotifications24h: (notificationRows as Array<{ n: number }>)[0]?.n ?? 0 };
  cachedAt = Date.now();
  return cached;
}

new client.Gauge({
  name: 'vargly_domain_events',
  help: 'Domain events not yet delivered (PENDING/FAILED) or given up on (DEAD); alert on DEAD > 0',
  labelNames: ['status'],
  async collect() {
    try {
      const { events } = await loadOperationalCounts();
      for (const [status, n] of Object.entries(events)) this.set({ status }, n);
    } catch (err) {
      logger.warn('[Metrics] Could not read domain event counts', { error: (err as Error).message });
    }
  },
});

new client.Gauge({
  name: 'vargly_notifications_failed_24h',
  help: 'WhatsApp/email notifications that failed in the last 24 hours',
  async collect() {
    try {
      this.set((await loadOperationalCounts()).failedNotifications24h);
    } catch (err) {
      logger.warn('[Metrics] Could not read notification counts', { error: (err as Error).message });
    }
  },
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime();

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds + nanoseconds / 1e9;
    // Label by route pattern ("/api/v1/students/:id"), never the raw path: raw paths (ids, 404
    // probes) would create an unbounded number of time series
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    const statusCode = res.statusCode.toString();

    httpRequestsTotal.inc({ method: req.method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method: req.method, route, status_code: statusCode }, duration);
  });

  next();
}

/**
 * Metrics describe internal traffic and health, so they are not public: scrapers send
 * `Authorization: Bearer <METRICS_TOKEN>`. In production the endpoint is disabled until a token
 * is configured; in development it is open when no token is set.
 */
export async function getMetricsHandler(req: Request, res: Response): Promise<void> {
  const token = envConfig.get('METRICS_TOKEN');
  if (!token && envConfig.get('NODE_ENV') === 'production') {
    res.status(StatusCodes.NOT_FOUND).end();
    return;
  }
  if (token) {
    const header = req.headers.authorization ?? '';
    if (!safeEqual(header, `Bearer ${token}`)) {
      res.status(StatusCodes.UNAUTHORIZED).end();
      return;
    }
  }

  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
}
