import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { DomainEvent } from '@vargly/types';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { createTenantPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { EventBus } from '../../events/event-bus.js';
import { PrismaEventStore } from '../../events/event-store.js';
import { PrismaNotificationRepository } from '../../modules/notifications/notification.repository.js';
import { PrismaWhatsAppAssistantRepository } from '../../modules/whatsapp-assistant/whatsapp-assistant.repository.js';

/**
 * Phase 4 gate against real PostgreSQL and Redis: events survive handler failures and crashes
 * and are delivered once per handler; a notification is sent by one worker; an inbound
 * WhatsApp message is handled once however often Meta delivers it.
 */
const APP_URL = process.env.TEST_DATABASE_URL;
const OWNER_URL = process.env.TEST_DATABASE_OWNER_URL;
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);

const COACHING = 'ffffffff-0000-4000-8000-000000000001';

const event = (id: string): DomainEvent<{ at: Date }> => ({
  eventId: id,
  eventName: 'ReliabilityProbe',
  coachingId: COACHING,
  occurredAt: new Date(),
  payload: { at: new Date('2026-10-01T00:00:00Z') },
  metadata: { correlationId: 'corr' },
});

describe.skipIf(!APP_URL || !OWNER_URL)('Reliable delivery (real PostgreSQL + Redis)', () => {
  let owner: PrismaClient;
  let appBase: PrismaClient;
  let db: ExtendedPrismaClient;
  let redis: Redis;

  const eventRow = async (id: string) =>
    (await owner.$queryRaw<any[]>`SELECT status, attempts, completed_handlers FROM domain_events WHERE id = ${id}`)[0];

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: OWNER_URL } } });
    appBase = new PrismaClient({ datasources: { db: { url: APP_URL } } });
    db = createTenantPrismaClient(appBase);
    redis = new Redis({ port: REDIS_PORT, maxRetriesPerRequest: 1 });
  });

  beforeEach(async () => {
    await owner.$transaction([
      owner.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`,
      owner.$executeRawUnsafe('TRUNCATE coachings, domain_events, notification_history CASCADE'),
      owner.coaching.create({ data: { id: COACHING, name: 'Reliable Co', code: 'reliable', phone: '1', email: 'r@r.in' } }),
    ]);
    await redis.flushdb();
  });

  afterAll(async () => {
    await owner?.$disconnect();
    await appBase?.$disconnect();
    redis?.disconnect();
  });

  describe('durable domain events', () => {
    it('records the outcome, retries only the failed handler, and ends dispatched', async () => {
      const bus = new EventBus();
      bus.useStore(new PrismaEventStore(db));
      const notify = vi.fn();
      const timeline = vi.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValue(undefined);
      bus.subscribe('ReliabilityProbe', notify);
      bus.subscribe('ReliabilityProbe', timeline);

      await bus.publish(event('evt-retry'));
      expect(await eventRow('evt-retry')).toMatchObject({
        status: 'FAILED',
        attempts: 1,
        completed_handlers: ['ReliabilityProbe#0'],
      });

      // Not due yet: the backoff has to pass first
      expect(await bus.redeliverDue()).toBe(0);
      await owner.$executeRaw`UPDATE domain_events SET next_attempt_at = now() WHERE id = 'evt-retry'`;
      expect(await bus.redeliverDue()).toBe(1);

      expect(notify).toHaveBeenCalledTimes(1);
      expect(timeline).toHaveBeenCalledTimes(2);
      expect(await eventRow('evt-retry')).toMatchObject({ status: 'DISPATCHED', attempts: 2 });
    });

    it('recovers events a crashed process recorded but never finished', async () => {
      const crashed = new PrismaEventStore(db);
      await crashed.record(event('evt-crash') as DomainEvent<unknown>);
      await owner.$executeRaw`UPDATE domain_events SET created_at = now() - interval '5 minutes' WHERE id = 'evt-crash'`;

      const worker = new EventBus();
      worker.useStore(new PrismaEventStore(db));
      let received: any;
      worker.subscribe('ReliabilityProbe', (e) => {
        received = e;
      });

      expect(await worker.redeliverDue()).toBe(1);
      expect(received.payload.at).toBeInstanceOf(Date);
      expect(received.coachingId).toBe(COACHING);
      expect(await eventRow('evt-crash')).toMatchObject({ status: 'DISPATCHED' });
    });

    it('never hands the same due event to two relays at once', async () => {
      const store = new PrismaEventStore(db);
      for (let n = 0; n < 20; n++) await store.record(event(`evt-lease-${n}`) as DomainEvent<unknown>);
      await owner.$executeRaw`UPDATE domain_events SET status = 'FAILED', next_attempt_at = now() - interval '1 second'`;

      const [a, b, c] = await Promise.all([store.claimDue(10), store.claimDue(10), store.claimDue(10)]);
      const ids = [...a, ...b, ...c].map((s) => s.event.eventId);
      expect(ids).toHaveLength(20);
      expect(new Set(ids).size).toBe(20);
    });
  });

  describe('notification sending', () => {
    it('lets exactly one of many concurrent workers claim a notification', async () => {
      await owner.$transaction([
        owner.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`,
        owner.notificationHistory.create({
          data: {
            coachingId: COACHING,
            channel: 'WHATSAPP',
            recipient: '+919876543210',
            recipientType: 'PARENT',
            content: 'Fee reminder',
            idempotencyKey: 'fee.reminder.x.D0',
          },
        }),
      ]);
      const repo = new PrismaNotificationRepository(db);

      const claims = await Promise.all(
        Array.from({ length: 8 }, () =>
          RequestContextService.runForTenant(COACHING, () => repo.claimForSending('fee.reminder.x.D0')),
        ),
      );
      expect(claims.filter(Boolean)).toHaveLength(1);

      // Once sent, it is never claimed again
      await RequestContextService.runForTenant(COACHING, () =>
        repo.updateStatus('fee.reminder.x.D0', 'SENT' as any, { sentAt: new Date() }),
      );
      expect(await RequestContextService.runForTenant(COACHING, () => repo.claimForSending('fee.reminder.x.D0'))).toBe(false);
    });
  });

  describe('inbound WhatsApp messages', () => {
    it('claims a message id once across workers, and releases it for a retry after a failure', async () => {
      const repo = new PrismaWhatsAppAssistantRepository(db, () => redis);

      const claims = await Promise.all(Array.from({ length: 6 }, () => repo.claimMessage('wamid.DUP1')));
      expect(claims.filter(Boolean)).toHaveLength(1);

      await repo.releaseMessage('wamid.DUP1');
      expect(await repo.claimMessage('wamid.DUP1')).toBe(true);
    });

    it('keeps conversation state in Redis, per coaching and phone format-independent', async () => {
      const writer = new PrismaWhatsAppAssistantRepository(db, () => redis);
      const reader = new PrismaWhatsAppAssistantRepository(db, () => redis); // another process

      await writer.saveConversationContext(COACHING, '+91 98765-43210', {
        parentId: 'p1',
        studentIds: ['s1', 's2'],
        awaitingChildSelection: true,
        lastInteractionAt: new Date('2026-09-24T10:00:00Z'),
      });

      const context = await reader.getConversationContext(COACHING, '9876543210');
      expect(context).toMatchObject({ parentId: 'p1', awaitingChildSelection: true });
      expect(context?.lastInteractionAt).toBeInstanceOf(Date);
      expect(await reader.getConversationContext('another-coaching', '9876543210')).toBeNull();
    });
  });
});
