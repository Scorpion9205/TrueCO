import { getPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';

/** Receipt numbers look like RCT/2026-27/00001 */
export const DEFAULT_RECEIPT_PREFIX = 'RCT';
export const RECEIPT_PREFIX_PATTERN = /^[A-Z0-9]{2,10}$/;

/** The settings other modules act on */
export interface CoachingPreferences {
  readonly receiptPrefix: string;
  /** Automatic WhatsApp messages (absence alerts, fee reminders, notices, results) */
  readonly whatsappEnabled: boolean;
}

/**
 * Reads preferences from a settings config. Registration stored the WhatsApp switch under
 * `channels`, the settings API under `notifications`; either is honoured, the latter first.
 */
export function preferencesFrom(config: unknown): CoachingPreferences {
  const value = (config && typeof config === 'object' ? config : {}) as Record<string, any>;
  const prefix = typeof value.receiptPrefix === 'string' ? value.receiptPrefix : '';
  const whatsapp = value.notifications?.whatsappEnabled ?? value.channels?.whatsappEnabled;
  return {
    receiptPrefix: RECEIPT_PREFIX_PATTERN.test(prefix) ? prefix : DEFAULT_RECEIPT_PREFIX,
    whatsappEnabled: whatsapp !== false,
  };
}

/** @param db a Prisma client or an interactive transaction */
export async function readPreferences(db: any, coachingId: string): Promise<CoachingPreferences> {
  const setting = await db.setting.findUnique({ where: { coachingId }, select: { config: true } });
  return preferencesFrom(setting?.config);
}

export const readCoachingPreferences = (coachingId: string): Promise<CoachingPreferences> =>
  readPreferences(getPrismaClient(), coachingId);
