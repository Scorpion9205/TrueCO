import { describe, it, expect, vi } from 'vitest';
import { SubscriptionStatus } from '@vargly/types';
import { effectiveSubscription } from '../../modules/billing/subscription-status.js';
import { ReminderWorker, SUBSCRIPTION_SCAN_JOB } from '../../workers/reminder.worker.js';
import {
  NotificationSubscribers,
  subscriptionReminderText,
} from '../../modules/notifications/notification.subscribers.js';
import { NotificationService } from '../../modules/notifications/notification.service.js';
import { EventBus } from '../../events/event-bus.js';
import { BILLING_EVENTS } from '../../modules/billing/billing.events.js';
import { PrismaRiskEngineRepository } from '../../modules/risk-engine/risk-engine.repository.js';

const now = new Date('2026-10-01T06:00:00Z');

describe('effective subscription status', () => {
  it('reports a trial as ended from its end time, before the daily scan updates it', () => {
    const result = effectiveSubscription(
      { status: SubscriptionStatus.TRIALING, trialEndsAt: '2026-10-01T05:00:00Z' },
      now,
    );
    expect(result).toMatchObject({ status: SubscriptionStatus.EXPIRED, daysRemaining: 0 });
  });

  it('counts a paid plan down to its period end, not the old trial date', () => {
    const result = effectiveSubscription(
      {
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: '2026-08-01T00:00:00Z',
        currentPeriodEnd: '2026-10-11T06:00:00Z',
      },
      now,
    );
    expect(result).toMatchObject({ status: SubscriptionStatus.ACTIVE, daysRemaining: 10 });
  });

  it('leaves cancelled plans as they are', () => {
    expect(
      effectiveSubscription({ status: SubscriptionStatus.CANCELLED, currentPeriodEnd: '2026-01-01' }, now)
        .status,
    ).toBe(SubscriptionStatus.CANCELLED);
  });
});

describe('the daily subscription scan', () => {
  it('runs the expiry check for its own job and fee reminders for the others', async () => {
    const fees = { runDailyReminderCheck: vi.fn().mockResolvedValue(2) };
    const subscriptions = { runDailyExpirationCheck: vi.fn().mockResolvedValue(1) };
    const worker = new ReminderWorker(fees as any, subscriptions as any);

    await worker.process({ name: SUBSCRIPTION_SCAN_JOB, id: '1', data: {} } as any);
    await worker.process({ name: 'hourly_fee_reminder_scan', id: '2', data: {} } as any);

    expect(subscriptions.runDailyExpirationCheck).toHaveBeenCalledTimes(1);
    expect(fees.runDailyReminderCheck).toHaveBeenCalledTimes(1);
  });

  it('tells the owner on WhatsApp when the plan is about to end', async () => {
    const eventBus = new EventBus();
    const enqueue = vi.fn().mockResolvedValue({});
    NotificationSubscribers.register(
      eventBus,
      { enqueueNotification: enqueue } as unknown as NotificationService,
      async () => ({ receiptPrefix: 'RCT', whatsappEnabled: true }),
    );
    await eventBus.publish({
      eventId: 'e1',
      eventName: BILLING_EVENTS.SUBSCRIPTION_EXPIRING,
      occurredAt: new Date(),
      payload: { coachingId: 'c1', planCode: 'PRO_AI', trialEndsAt: new Date('2026-10-04'), daysRemaining: 3 },
      metadata: { correlationId: 'x' },
    } as any);

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'coaching:c1:owner',
        content: expect.stringContaining('in 3 days'),
        idempotencyKey: 'subscription.expiring.c1.2026-10-04.3',
      }),
      'c1',
      'x',
    );
  });

  it('words the reminder for tomorrow and for an ended plan', () => {
    expect(subscriptionReminderText(1)).toContain('ends tomorrow');
    expect(subscriptionReminderText(0)).toContain('has ended');
  });
});

describe('risk list filters', () => {
  it('keeps both ends of a score range and leaves out deleted students', async () => {
    let where: any;
    const prisma = { riskScore: { findMany: async (args: any) => ((where = args.where), []) } };
    await new PrismaRiskEngineRepository(prisma as any).findMany('c1', { minScore: 40, maxScore: 80 });
    expect(where.score).toEqual({ gte: 40, lte: 80 });
    expect(where.student).toEqual({ deletedAt: null });
  });
});
