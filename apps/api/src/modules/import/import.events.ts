import { DomainEvent } from '@vargly/types';
import { ImportEntityType } from './dto/import.dto.js';

export interface BulkDataImportedPayload {
  readonly coachingId: string;
  readonly entityType: ImportEntityType;
  readonly totalRows: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly dryRun: boolean;
}

export const IMPORT_EVENTS = {
  BULK_DATA_IMPORTED: 'BulkDataImported',
} as const;

export function createBulkDataImportedEvent(
  payload: BulkDataImportedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<BulkDataImportedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: IMPORT_EVENTS.BULK_DATA_IMPORTED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
