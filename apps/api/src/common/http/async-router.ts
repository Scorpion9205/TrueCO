import { Router, RouterOptions, Request, Response, NextFunction, RequestHandler } from 'express';

const ROUTE_METHODS = ['all', 'get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'use'] as const;

/**
 * Wraps a handler so that both synchronous throws and rejected promises are
 * forwarded to `next(err)`. Express 4 does not do this for async handlers, and
 * an unforwarded rejection terminates the process on Node >= 15.
 */
export function forwardErrors(handler: RequestHandler): RequestHandler {
  return function forwardingHandler(req: Request, res: Response, next: NextFunction): void {
    try {
      const result: unknown = handler(req, res, next);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

function wrapArgument(arg: unknown): unknown {
  if (Array.isArray(arg)) return arg.map(wrapArgument);
  if (typeof arg !== 'function') return arg;
  // Leave nested routers/apps and error-handling middleware (arity 4) untouched
  if ('stack' in arg || arg.length === 4) return arg;
  return forwardErrors(arg as RequestHandler);
}

/**
 * Drop-in replacement for `express.Router()` whose route handlers and
 * middleware forward async errors to the global error handler.
 */
export function createRouter(options?: RouterOptions): Router {
  const router = Router(options);
  for (const method of ROUTE_METHODS) {
    const original = (router as any)[method].bind(router);
    (router as any)[method] = (...args: unknown[]) => original(...args.map(wrapArgument));
  }
  return router;
}
