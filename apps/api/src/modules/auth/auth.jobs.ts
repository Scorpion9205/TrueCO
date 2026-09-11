import { queueRegistry, QUEUE_NAMES } from '../../queues/queue.registry.js';
import { logger } from '../../common/logger/logger.service.js';

export class AuthJobs {
  public static async enqueuePasswordResetEmail(email: string, resetToken: string, coachingId: string): Promise<void> {
    const queue = queueRegistry.getQueue(QUEUE_NAMES.EMAIL);
    const idempotencyKey = `email:password_reset:${email}:${Date.now()}`;

    await queue.add(
      'send-password-reset',
      {
        to: email,
        template: 'password-reset',
        variables: { resetToken },
        coachingId,
        idempotencyKey,
      },
      { jobId: idempotencyKey },
    );

    logger.info(`[AuthJobs] Enqueued password reset email for ${email}`);
  }
}
