import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Enable default runtime & process metrics (CPU, Memory, Event Loop, Heap)
client.collectDefaultMetrics({
  prefix: 'trueco_',
});

export const httpRequestsTotal = new client.Counter({
  name: 'trueco_http_requests_total',
  help: 'Total number of incoming HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'trueco_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const bullMqJobsProcessedTotal = new client.Counter({
  name: 'trueco_bullmq_jobs_processed_total',
  help: 'Total number of BullMQ background jobs processed',
  labelNames: ['queue', 'status'],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime();

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds + nanoseconds / 1e9;
    const route = req.route?.path || req.path || 'unknown';
    const statusCode = res.statusCode.toString();

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: statusCode,
    });

    httpRequestDurationSeconds.observe(
      {
        method: req.method,
        route,
        status_code: statusCode,
      },
      duration,
    );
  });

  next();
}

export async function getMetricsHandler(_req: Request, res: Response): Promise<void> {
  res.set('Content-Type', client.register.contentType);
  const metrics = await client.register.metrics();
  res.end(metrics);
}
