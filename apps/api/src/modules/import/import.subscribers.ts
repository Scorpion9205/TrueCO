import { IEventBus } from '../../events/event-bus.interface.js';
import { IMPORT_EVENTS, BulkDataImportedPayload } from './import.events.js';
import { DomainEvent } from '@trueco/types';
import { logger } from '../../common/logger/logger.service.js';

export class ImportSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(
      IMPORT_EVENTS.BULK_DATA_IMPORTED,
      (event: DomainEvent<BulkDataImportedPayload>) => {
        logger.info(
          `[ImportSubscribers] Bulk import complete for ${event.payload.entityType} in coaching ${event.payload.coachingId}. (Success: ${event.payload.successCount}, Errors: ${event.payload.errorCount}, DryRun: ${event.payload.dryRun})`,
        );
      },
    );
  }
}
