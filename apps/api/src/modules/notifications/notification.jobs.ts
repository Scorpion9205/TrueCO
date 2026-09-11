import { logger } from '../../common/logger/logger.service.js';

export class NotificationJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[NotificationJobs] BullMQ notification queues registered via QueueRegistry');
  }
}
