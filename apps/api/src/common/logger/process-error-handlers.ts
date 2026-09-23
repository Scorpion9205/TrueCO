import { logger } from './logger.service.js';

let registered = false;

/**
 * Last-resort handlers. A stray rejected promise is logged instead of killing
 * every in-flight request; an uncaught exception leaves the process in an
 * unknown state, so it is logged and the process exits for the orchestrator
 * to restart.
 */
export function registerProcessErrorHandlers(processName: string): void {
  if (registered) return;
  registered = true;

  process.on('unhandledRejection', (reason) => {
    logger.error(`[${processName}] Unhandled promise rejection`, reason);
  });

  process.on('uncaughtException', (err) => {
    logger.error(`[${processName}] Uncaught exception, exiting`, err);
    process.exit(1);
  });
}
