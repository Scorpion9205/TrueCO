import { DomainEvent } from '@vargly/types';
import { getPrismaClient, ExtendedPrismaClient } from '../database/prisma/tenant-prisma.extension.js';
import { RequestContextService } from '../common/services/request-context.service.js';

export interface HandlerFailure {
  readonly handler: string;
  readonly error: string;
}

export interface StoredEvent {
  readonly event: DomainEvent<unknown>;
  readonly completedHandlers: string[];
  readonly attempts: number;
}

/** Durable record of published events and which of their handlers have completed. */
export interface IEventStore {
  /** Records the event before its handlers run. Re-recording the same event id is a no-op. */
  record(event: DomainEvent<unknown>): Promise<void>;
  /** Stores the outcome of one dispatch attempt. */
  markResult(eventId: string, succeeded: string[], failures: HandlerFailure[]): Promise<void>;
  /** Leases events that need another attempt: failed ones whose backoff has passed, and ones left pending by a crash. */
  claimDue(limit: number): Promise<StoredEvent[]>;
}

export const MAX_EVENT_ATTEMPTS = 10;
const STALE_PENDING_SECONDS = 120;
const LEASE_SECONDS = 300;
// Retry backoff (in markResult): 30 s after the first failure, doubling, capped at 1 hour

// JSON has no dates; tag them so handlers get Date objects back when an event is re-delivered
export function encodeForStorage(value: unknown): unknown {
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(encodeForStorage);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeForStorage(v)]));
  }
  return value;
}

export function decodeFromStorage(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeFromStorage);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).length === 1 && typeof obj.$date === 'string') return new Date(obj.$date);
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, decodeFromStorage(v)]));
  }
  return value;
}

export class PrismaEventStore implements IEventStore {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  private get db(): any {
    return this.prisma as any;
  }

  public async record(event: DomainEvent<unknown>): Promise<void> {
    await RequestContextService.runAsSystem('events:record', () =>
      this.db.$executeRaw`
        INSERT INTO domain_events (id, event_name, coaching_id, payload, metadata, occurred_at, updated_at)
        VALUES (
          ${event.eventId}, ${event.eventName}, ${String(event.coachingId ?? '')},
          ${JSON.stringify(encodeForStorage(event.payload))}::jsonb,
          ${JSON.stringify(encodeForStorage(event.metadata ?? {}))}::jsonb,
          ${new Date(event.occurredAt ?? Date.now())}, now()
        )
        ON CONFLICT (id) DO NOTHING
      `,
    );
  }

  public async markResult(eventId: string, succeeded: string[], failures: HandlerFailure[]): Promise<void> {
    const lastError = failures.length ? failures.map((f) => `${f.handler}: ${f.error}`).join('\n').slice(0, 4000) : null;
    await RequestContextService.runAsSystem('events:mark-result', () =>
      this.db.$executeRaw`
        UPDATE domain_events SET
          completed_handlers = ARRAY(SELECT DISTINCT unnest(completed_handlers || ${succeeded}::text[])),
          attempts = attempts + 1,
          status = (CASE
            WHEN ${failures.length} = 0 THEN 'DISPATCHED'
            WHEN attempts + 1 >= ${MAX_EVENT_ATTEMPTS} THEN 'DEAD'
            ELSE 'FAILED'
          END)::domain_event_status,
          last_error = ${lastError},
          dispatched_at = (CASE WHEN ${failures.length} = 0 THEN now() ELSE dispatched_at END),
          next_attempt_at = now() + make_interval(secs => LEAST(30 * power(2, attempts), 3600)),
          updated_at = now()
        WHERE id = ${eventId}
      `,
    );
  }

  public async claimDue(limit: number): Promise<StoredEvent[]> {
    const rows: any[] = await RequestContextService.runAsSystem('events:claim', () =>
      this.db.$queryRaw`
        UPDATE domain_events SET next_attempt_at = now() + make_interval(secs => ${LEASE_SECONDS}), updated_at = now()
        WHERE id IN (
          SELECT id FROM domain_events
          WHERE next_attempt_at <= now()
            AND (status = 'FAILED'
              OR (status = 'PENDING' AND created_at <= now() - make_interval(secs => ${STALE_PENDING_SECONDS})))
          ORDER BY next_attempt_at
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, event_name, coaching_id, payload, metadata, occurred_at, completed_handlers, attempts
      `,
    );
    return rows.map((row) => ({
      event: {
        eventId: row.id,
        eventName: row.event_name,
        coachingId: row.coaching_id,
        occurredAt: row.occurred_at,
        payload: decodeFromStorage(row.payload),
        metadata: decodeFromStorage(row.metadata) as DomainEvent<unknown>['metadata'],
      },
      completedHandlers: row.completed_handlers ?? [],
      attempts: row.attempts,
    }));
  }
}
