import { describe, it, expect } from 'vitest';
import { SubscriptionStatus } from '@vargly/types';
import {
  assertContentMatchesType,
  assertUploadAllowed,
  sanitizeFileName,
} from '../../common/storage/upload-policy.js';
import { evaluateSubscriptionAccess, SubscriptionState } from '../../common/decorators/require-feature.decorator.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const PDF = Buffer.from('%PDF-1.7\n...');

describe('upload policy', () => {
  it('accepts allowed types within the size limit', () => {
    expect(() => assertUploadAllowed('avatar', 'image/png', 1024)).not.toThrow();
    expect(() => assertUploadAllowed('receipt', 'application/pdf', 1024)).not.toThrow();
  });

  it('rejects script-capable and unlisted types', () => {
    expect(() => assertUploadAllowed('general', 'image/svg+xml')).toThrow(/cannot be uploaded/);
    expect(() => assertUploadAllowed('homework', 'text/html')).toThrow(/cannot be uploaded/);
    expect(() => assertUploadAllowed('avatar', 'application/pdf')).toThrow(/cannot be uploaded/);
  });

  it('rejects files over the category limit', () => {
    expect(() => assertUploadAllowed('avatar', 'image/png', 3 * 1024 * 1024)).toThrow(/limited to 2 MB/);
  });

  it('rejects content that does not match the declared type', () => {
    expect(() => assertContentMatchesType(PNG, 'image/png')).not.toThrow();
    expect(() => assertContentMatchesType(PDF, 'application/pdf')).not.toThrow();
    expect(() => assertContentMatchesType(Buffer.from('<script>alert(1)</script>'), 'image/png')).toThrow(
      /not a valid image\/png/,
    );
    expect(() => assertContentMatchesType(Buffer.alloc(0), 'image/png')).toThrow(/empty/);
  });

  it('strips directories and unsafe characters from file names', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('C:\\Users\\a\\My Report (final).pdf')).toBe('My_Report_final_.pdf');
    expect(sanitizeFileName('.hidden')).toBe('hidden');
    expect(sanitizeFileName('////')).toBe('file');
  });
});

describe('subscription access rule', () => {
  const now = new Date('2026-09-24T12:00:00Z');
  const state = (status: SubscriptionStatus, accessUntil: string): SubscriptionState => ({
    status,
    enabledFeatures: [],
    accessUntil,
  });

  it('allows an unexpired trial and an active paid period', () => {
    expect(evaluateSubscriptionAccess(state(SubscriptionStatus.TRIALING, '2026-10-01T00:00:00Z'), now)).toMatchObject({
      allowed: true,
      isTrialing: true,
    });
    expect(evaluateSubscriptionAccess(state(SubscriptionStatus.ACTIVE, '2026-10-01T00:00:00Z'), now).allowed).toBe(true);
  });

  it('blocks a trial whose end date has passed even if the status column still says TRIALING', () => {
    expect(evaluateSubscriptionAccess(state(SubscriptionStatus.TRIALING, '2026-09-01T00:00:00Z'), now)).toMatchObject({
      allowed: false,
      code: 'TRIAL_EXPIRED',
    });
  });

  it('blocks lapsed paid periods, expired or cancelled subscriptions, and missing ones', () => {
    expect(evaluateSubscriptionAccess(state(SubscriptionStatus.ACTIVE, '2026-09-01T00:00:00Z'), now)).toMatchObject({
      code: 'SUBSCRIPTION_EXPIRED',
    });
    expect(evaluateSubscriptionAccess(state(SubscriptionStatus.CANCELLED, '2027-01-01T00:00:00Z'), now).allowed).toBe(false);
    expect(evaluateSubscriptionAccess(null, now)).toMatchObject({ allowed: false, code: 'NO_ACTIVE_SUBSCRIPTION' });
  });
});
