import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoachingService } from '../../modules/coaching/coaching.service.js';
import { ICoachingRepository, CreateCoachingTransactionInput } from '../../modules/coaching/coaching.repository.js';
import { IPasswordService } from '../../common/security/password.service.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { PlanCode, SubscriptionStatus } from '@trueco/types';

class InMemoryCoachingRepository implements ICoachingRepository {
  public coachings: Map<string, any> = new Map();

  public async findByCode(code: string): Promise<any | null> {
    for (const c of this.coachings.values()) {
      if (c.code === code) return c;
    }
    return null;
  }

  public async findById(id: string): Promise<any | null> {
    return this.coachings.get(id) || null;
  }

  public async update(id: string, data: Record<string, unknown>): Promise<any> {
    const coaching = { ...this.coachings.get(id), ...data };
    this.coachings.set(id, coaching);
    return coaching;
  }

  public async createWithProvisioning(input: CreateCoachingTransactionInput): Promise<{ coaching: any; ownerUser: any }> {
    const coachingId = `coaching-${Date.now()}`;
    const ownerId = `user-${Date.now()}`;

    const trialStartsAt = new Date();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + input.trialDays);

    const coaching = {
      id: coachingId,
      name: input.coachingName,
      code: input.coachingCode,
      phone: input.phone,
      email: input.email,
      address: input.address,
      city: input.city,
      state: input.state,
      timezone: input.timezone,
      currency: input.currency,
      createdAt: new Date(),
      subscriptions: [
        {
          id: 'sub-1',
          status: SubscriptionStatus.TRIALING,
          trialStartsAt,
          trialEndsAt,
          plan: {
            code: PlanCode.ENTERPRISE,
            defaultFeatures: ['core', 'attendance', 'fees', 'ai.summary', 'ai.parent_report'],
          },
        },
      ],
    };

    const ownerUser = {
      id: ownerId,
      email: input.ownerEmail,
      name: input.ownerName,
    };

    this.coachings.set(coachingId, coaching);
    return { coaching, ownerUser };
  }
}

describe('CoachingService (Phase 1 Domain Unit Tests)', () => {
  let coachingService: CoachingService;
  let coachingRepo: InMemoryCoachingRepository;
  let mockPasswordService: IPasswordService;
  let mockEventBus: IEventBus;

  beforeEach(() => {
    coachingRepo = new InMemoryCoachingRepository();

    mockPasswordService = {
      hash: vi.fn().mockResolvedValue('argon2_hashed_password'),
      verify: vi.fn().mockResolvedValue(true),
    };

    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };

    coachingService = new CoachingService(coachingRepo, mockPasswordService, mockEventBus);
  });

  it('should register a coaching institute with a 60-day full-feature trial', async () => {
    const result = await coachingService.registerCoaching({
      coachingName: 'Apex IIT Academy',
      coachingCode: 'apex-iit',
      phone: '9876543210',
      email: 'contact@apexiit.com',
      ownerName: 'Dr. Sharma',
      ownerEmail: 'sharma@apexiit.com',
      ownerPhone: '9876543210',
      ownerPassword: 'SecurePassword123!',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    });

    expect(result.code).toBe('apex-iit');
    expect(result.name).toBe('Apex IIT Academy');
    expect(result.subscription.status).toBe(SubscriptionStatus.TRIALING);
    expect(result.subscription.daysRemaining).toBe(60);
    expect(result.subscription.features).toContain('ai.parent_report');
    expect(mockPasswordService.hash).toHaveBeenCalledWith('SecurePassword123!');
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('should reject registration if coaching code is already taken', async () => {
    coachingRepo.coachings.set('existing', {
      id: 'existing',
      code: 'apex-iit',
    });

    await expect(
      coachingService.registerCoaching({
        coachingName: 'Another Academy',
        coachingCode: 'apex-iit',
        phone: '9876543210',
        email: 'another@test.com',
        ownerName: 'Owner',
        ownerEmail: 'owner@test.com',
        ownerPhone: '9876543210',
        ownerPassword: 'Password123',
      }),
    ).rejects.toThrow(/already registered/);
  });
});
