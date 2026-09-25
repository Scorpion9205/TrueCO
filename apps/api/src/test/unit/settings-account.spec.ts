import { describe, it, expect, vi } from 'vitest';
import { AuthService } from '../../modules/auth/auth.service.js';
import { changePasswordSchema } from '../../modules/auth/validators/auth.validator.js';
import { updateCoachingSchema } from '../../modules/coaching/validators/coaching.validator.js';
import { updateSettingsSchema } from '../../modules/settings/validators/settings.validator.js';
import {
  preferencesFrom,
  readPreferences,
} from '../../modules/settings/settings.preferences.js';
import { NotificationSubscribers } from '../../modules/notifications/notification.subscribers.js';
import { NotificationService } from '../../modules/notifications/notification.service.js';
import { PasswordService } from '../../common/security/password.service.js';
import { TokenService } from '../../common/security/token.service.js';
import { EventBus } from '../../events/event-bus.js';
import { NOTICE_EVENTS } from '../../modules/notice-board/notice.events.js';

describe('changing a password', () => {
  async function setup() {
    const passwords = new PasswordService();
    const user = { id: 'u1', passwordHash: await passwords.hash('Old@Password1'), isActive: true };
    const updates: string[] = [];
    const revoked: string[] = [];
    const service = new AuthService(
      {
        findById: async (id: string) => (id === 'u1' ? user : null),
        updatePassword: async (_id: string, hash: string) => void updates.push(hash),
      } as any,
      { revokeAllForUser: async (id: string) => void revoked.push(id) } as any,
      passwords,
      TokenService.getInstance(),
      {} as any,
      { publish: async () => {}, subscribe: () => {} } as any,
    );
    return { service, passwords, updates, revoked };
  }

  it('checks the current password, stores the new one and signs out every session', async () => {
    const { service, passwords, updates, revoked } = await setup();
    await service.changePassword('u1', 'Old@Password1', 'New@Password2');
    expect(updates).toHaveLength(1);
    expect(await passwords.verify(updates[0]!, 'New@Password2')).toBe(true);
    expect(revoked).toEqual(['u1']);
  });

  it('refuses a wrong current password, pointing at that field', async () => {
    const { service, updates, revoked } = await setup();
    await expect(service.changePassword('u1', 'guess', 'New@Password2')).rejects.toMatchObject({
      code: 'WRONG_PASSWORD',
      details: [{ path: ['currentPassword'] }],
    });
    expect(updates).toEqual([]);
    expect(revoked).toEqual([]);
  });

  it('refuses reusing the same password', async () => {
    const { service } = await setup();
    await expect(
      service.changePassword('u1', 'Old@Password1', 'Old@Password1'),
    ).rejects.toMatchObject({ code: 'SAME_PASSWORD' });
  });

  it('needs at least 8 characters', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: 'short' }).success).toBe(false);
  });
});

describe('institute details', () => {
  it('can change contact details and clear the address, but never the code', () => {
    expect(
      updateCoachingSchema.safeParse({ name: 'Apex Academy', address: null, email: 'A@B.IN' }),
    ).toMatchObject({ success: true, data: { email: 'a@b.in', address: null } });
    expect(updateCoachingSchema.safeParse({ code: 'new-code' }).success).toBe(false);
  });
});

describe('settings', () => {
  it('refuses unknown keys instead of storing them', () => {
    expect(updateSettingsSchema.safeParse({ extraConfig: { receiptPrefix: '=X' } }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ isAdmin: true }).success).toBe(false);
  });

  it('accepts a short receipt prefix in capitals', () => {
    expect(updateSettingsSchema.safeParse({ receiptPrefix: 'apx' })).toMatchObject({
      success: true,
      data: { receiptPrefix: 'APX' },
    });
    expect(updateSettingsSchema.safeParse({ receiptPrefix: 'A/B' }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ receiptPrefix: 'X' }).success).toBe(false);
  });

  it('reads preferences from either place registration or settings stored them', () => {
    expect(preferencesFrom(null)).toEqual({ receiptPrefix: 'RCT', whatsappEnabled: true });
    expect(preferencesFrom({ channels: { whatsappEnabled: false } }).whatsappEnabled).toBe(false);
    expect(
      preferencesFrom({ channels: { whatsappEnabled: false }, notifications: { whatsappEnabled: true } })
        .whatsappEnabled,
    ).toBe(true);
    // A bad stored prefix falls back rather than printing it on receipts
    expect(preferencesFrom({ receiptPrefix: 'a b' }).receiptPrefix).toBe('RCT');
    expect(preferencesFrom({ receiptPrefix: 'APX' }).receiptPrefix).toBe('APX');
  });

  it('reads them through the transaction it is given', async () => {
    const db = {
      setting: { findUnique: vi.fn(async () => ({ config: { receiptPrefix: 'APX' } })) },
    };
    expect(await readPreferences(db, 'c1')).toEqual({ receiptPrefix: 'APX', whatsappEnabled: true });
    expect(db.setting.findUnique).toHaveBeenCalledWith({
      where: { coachingId: 'c1' },
      select: { config: true },
    });
  });
});

describe('the WhatsApp switch', () => {
  async function publishNotice(whatsappEnabled: boolean) {
    const eventBus = new EventBus();
    const enqueue = vi.fn().mockResolvedValue({});
    NotificationSubscribers.register(
      eventBus,
      { enqueueNotification: enqueue } as unknown as NotificationService,
      async () => ({ receiptPrefix: 'RCT', whatsappEnabled }),
    );
    await eventBus.publish({
      eventId: 'e1',
      eventName: NOTICE_EVENTS.NOTICE_CREATED,
      occurredAt: new Date(),
      payload: {
        noticeId: 'n1',
        coachingId: 'c1',
        title: 'Holiday',
        content: 'Closed Monday',
        targetAudience: 'PARENTS',
      },
      metadata: { correlationId: 'x' },
    } as any);
    return enqueue;
  }

  it('sends automatic messages while it is on', async () => {
    expect(await publishNotice(true)).toHaveBeenCalledTimes(1);
  });

  it('sends nothing on WhatsApp when the institute turned it off', async () => {
    expect(await publishNotice(false)).not.toHaveBeenCalled();
  });
});
