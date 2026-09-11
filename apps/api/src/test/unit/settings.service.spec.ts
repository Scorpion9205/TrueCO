import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsService, DEFAULT_COACHING_CONFIG } from '../../modules/settings/settings.service.js';
import { ISettingsRepository } from '../../modules/settings/settings.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { SETTINGS_EVENTS } from '../../modules/settings/settings.events.js';

class InMemorySettingsRepository implements ISettingsRepository {
  public settings: Map<string, any> = new Map();

  public async findByCoachingId(coachingId: string): Promise<any | null> {
    return this.settings.get(coachingId) || null;
  }

  public async upsert(coachingId: string, config: Record<string, unknown>): Promise<any> {
    const existing = this.settings.get(coachingId) || {
      id: `setting-${crypto.randomUUID()}`,
      coachingId,
      createdAt: new Date(),
    };

    const updated = {
      ...existing,
      config,
      updatedAt: new Date(),
    };

    this.settings.set(coachingId, updated);
    return updated;
  }
}

describe('SettingsService (Phase 5 Settings Unit Tests)', () => {
  let settingsService: SettingsService;
  let settingsRepo: InMemorySettingsRepository;
  let mockEventBus: IEventBus;

  const testCoachingId = '11111111-1111-1111-1111-111111111111';
  const testUserId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    settingsRepo = new InMemorySettingsRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    settingsService = new SettingsService(settingsRepo, mockEventBus);
  });

  describe('getSettings', () => {
    it('returns default configuration if settings have not been customized', async () => {
      const result = await settingsService.getSettings(testCoachingId);

      expect(result.coachingId).toBe(testCoachingId);
      expect(result.config.timezone).toBe(DEFAULT_COACHING_CONFIG.timezone);
      expect(result.config.receiptPrefix).toBe(DEFAULT_COACHING_CONFIG.receiptPrefix);
      expect(result.config.attendanceThreshold).toBe(75);
    });
  });

  describe('updateSettings', () => {
    it('updates branding, receipt prefix, and notifications while merging existing values', async () => {
      const updated = await settingsService.updateSettings(
        {
          receiptPrefix: 'APEX',
          attendanceThreshold: 80,
          branding: {
            primaryColor: '#059669',
            headerText: 'Apex IIT Academy',
          },
          notifications: {
            whatsappEnabled: true,
            emailEnabled: false,
          },
        },
        testCoachingId,
        testUserId,
      );

      expect(updated.config.receiptPrefix).toBe('APEX');
      expect(updated.config.attendanceThreshold).toBe(80);
      expect(updated.config.branding?.primaryColor).toBe('#059669');
      expect(updated.config.branding?.headerText).toBe('Apex IIT Academy');
      expect(updated.config.notifications?.emailEnabled).toBe(false);
      // Preserved default timezone
      expect(updated.config.timezone).toBe(DEFAULT_COACHING_CONFIG.timezone);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: SETTINGS_EVENTS.SETTINGS_UPDATED,
          payload: expect.objectContaining({
            coachingId: testCoachingId,
            config: expect.objectContaining({
              receiptPrefix: 'APEX',
              attendanceThreshold: 80,
            }),
          }),
        }),
      );
    });
  });
});
