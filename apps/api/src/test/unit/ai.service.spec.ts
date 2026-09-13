import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiService, InsufficientAiCreditsError } from '../../modules/ai/ai.service.js';
import { InMemoryAiRepository } from '../../modules/ai/ai.repository.js';
import { AiProviderFactory } from '../../modules/ai/providers/ai-provider.factory.js';
import { MockAiProvider } from '../../modules/ai/providers/mock-ai.provider.js';
import { RedisPromptCache } from '../../modules/ai/cache/redis-prompt.cache.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AI_EVENTS } from '../../modules/ai/ai.events.js';
import { AiProviderType } from '@trueco/types';

describe('AiService (Phase 7 AI Service Layer Unit Tests)', () => {
  let aiService: AiService;
  let repository: InMemoryAiRepository;
  let promptCache: RedisPromptCache;
  let mockEventBus: IEventBus;
  const publishedEvents: any[] = [];

  const testCoachingId = '11111111-1111-1111-1111-111111111111';
  const testUserId = 'user-owner-123';

  beforeEach(() => {
    publishedEvents.length = 0;
    repository = new InMemoryAiRepository();
    promptCache = new RedisPromptCache();

    mockEventBus = {
      publish: vi.fn(async (event: any) => {
        publishedEvents.push(event);
      }),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };

    // Use mock provider for deterministic tests
    const mockProvider = new MockAiProvider();
    const providerFactory = new AiProviderFactory({
      [AiProviderType.OPENAI]: mockProvider,
      [AiProviderType.CLAUDE]: mockProvider,
      [AiProviderType.GEMINI]: mockProvider,
    });

    aiService = new AiService(repository, providerFactory, promptCache, mockEventBus);
  });

  describe('Wallet Management & Credit Pre-checks', () => {
    it('should initialize a new wallet with default 100 credits', async () => {
      const wallet = await aiService.getWalletBalance(testCoachingId);
      expect(wallet).toBeDefined();
      expect(wallet.coachingId).toBe(testCoachingId);
      expect(wallet.balance).toBe(100);
      expect(wallet.totalAllocated).toBe(100);
      expect(wallet.totalConsumed).toBe(0);
    });

    it('should reject generation with InsufficientAiCreditsError (402) when balance is insufficient', async () => {
      // Drain wallet
      const wallet = await repository.createOrGetWallet(testCoachingId, 0);
      expect(wallet.balance).toBe(0);

      await expect(
        aiService.generateCompletion(
          { prompt: 'Explain quantum physics' },
          testCoachingId,
          testUserId,
        ),
      ).rejects.toThrow(InsufficientAiCreditsError);

      try {
        await aiService.generateCompletion(
          { prompt: 'Explain quantum physics' },
          testCoachingId,
          testUserId,
        );
      } catch (err: any) {
        expect(err.statusCode).toBe(402);
        expect(err.code).toBe('INSUFFICIENT_AI_CREDITS');
        expect(err.currentBalance).toBe(0);
        expect(err.requiredCredits).toBe(1);
      }
    });

    it('should allow admin to top-up credits and emit AiCreditsAdded event', async () => {
      const updated = await aiService.addCredits(
        testCoachingId,
        { credits: 250, reason: 'Monthly Pro AI allotment' },
        testUserId,
      );

      expect(updated.balance).toBe(350); // 100 default + 250
      expect(updated.totalAllocated).toBe(350);

      const addedEvent = publishedEvents.find((e) => e.eventName === AI_EVENTS.CREDITS_ADDED);
      expect(addedEvent).toBeDefined();
      expect(addedEvent.payload.creditsAdded).toBe(250);
      expect(addedEvent.payload.newBalance).toBe(350);
      expect(addedEvent.payload.reason).toBe('Monthly Pro AI allotment');
    });
  });

  describe('Prompt Execution & Atomic Deduction', () => {
    it('should execute completion, atomically deduct credits, and log usage', async () => {
      const result = await aiService.generateCompletion(
        {
          prompt: 'Write a motivational quote for IIT-JEE aspirants',
          model: 'gpt-4o-mini',
        },
        testCoachingId,
        testUserId,
      );

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.creditsDeducted).toBe(1);
      expect(result.isCached).toBe(false);
      expect(result.balanceRemaining).toBe(99);

      // Verify DB wallet balance
      const wallet = await aiService.getWalletBalance(testCoachingId);
      expect(wallet.balance).toBe(99);
      expect(wallet.totalConsumed).toBe(1);

      // Verify domain events
      const deductEvent = publishedEvents.find((e) => e.eventName === AI_EVENTS.CREDITS_DEDUCTED);
      expect(deductEvent).toBeDefined();
      expect(deductEvent.payload.creditsDeducted).toBe(1);
      expect(deductEvent.payload.balanceRemaining).toBe(99);

      const completeEvent = publishedEvents.find((e) => e.eventName === AI_EVENTS.GENERATION_COMPLETED);
      expect(completeEvent).toBeDefined();
      expect(completeEvent.payload.isCached).toBe(false);
    });

    it('should return cached response with 0 credits deducted on identical prompt', async () => {
      const promptDto = {
        prompt: 'Generate revision checklist for Trigonometry',
        feature: 'ai.test_feature',
      };

      // 1. First invocation (Cache MISS)
      const firstResult = await aiService.generateCompletion(promptDto, testCoachingId, testUserId);
      expect(firstResult.isCached).toBe(false);
      expect(firstResult.creditsDeducted).toBe(1);
      expect(firstResult.balanceRemaining).toBe(99);

      // 2. Second invocation with identical prompt (Cache HIT)
      const secondResult = await aiService.generateCompletion(promptDto, testCoachingId, testUserId);
      expect(secondResult.isCached).toBe(true);
      expect(secondResult.content).toBe(firstResult.content);
      expect(secondResult.creditsDeducted).toBe(0);
      expect(secondResult.balanceRemaining).toBe(99); // Balance remained unchanged!

      // Verify wallet was only charged once
      const wallet = await aiService.getWalletBalance(testCoachingId);
      expect(wallet.balance).toBe(99);
      expect(wallet.totalConsumed).toBe(1);
    });
  });

  describe('Specialized Domain AI Features', () => {
    it('should generate student monthly progress narrative deducting 2 credits', async () => {
      const studentId = 'student-aarav-101';

      const result = await aiService.generateStudentMonthlyProgress(
        {
          studentId,
          month: 10,
          year: 2026,
          customNotes: 'Excellent participation in doubt clearing sessions',
        },
        testCoachingId,
        testUserId,
      );

      expect(result).toBeDefined();
      expect(result.feature).toBe('ai.student_narrative');
      expect(result.creditsDeducted).toBe(2);
      expect(result.content).toContain('academic');
      expect(result.balanceRemaining).toBe(98); // 100 - 2

      const wallet = await aiService.getWalletBalance(testCoachingId);
      expect(wallet.balance).toBe(98);
      expect(wallet.totalConsumed).toBe(2);
    });

    it('should generate parent WhatsApp report card deducting 1 credit', async () => {
      const studentId = 'student-aarav-101';

      const result = await aiService.generateParentWhatsAppReportCard(
        { studentId, includeTestHistory: true },
        testCoachingId,
        testUserId,
      );

      expect(result).toBeDefined();
      expect(result.feature).toBe('ai.parent_report');
      expect(result.creditsDeducted).toBe(1);
      expect(result.content).toContain('*'); // WhatsApp markdown bold
      expect(result.balanceRemaining).toBe(99);
    });

    it('should generate teacher performance insight deducting 3 credits', async () => {
      const teacherId = 'teacher-vikram-201';

      const result = await aiService.generateTeacherPerformanceInsight(
        { teacherId, periodDays: 30 },
        testCoachingId,
        testUserId,
      );

      expect(result).toBeDefined();
      expect(result.feature).toBe('ai.teacher_insight');
      expect(result.creditsDeducted).toBe(3);
      expect(result.content).toContain('Teacher');
      expect(result.balanceRemaining).toBe(97); // 100 - 3
    });
  });

  describe('Audit Trail & Usage Logs', () => {
    it('should record usage logs and return paginated history', async () => {
      await aiService.generateCompletion({ prompt: 'Test Prompt 1' }, testCoachingId, testUserId);
      await aiService.generateCompletion({ prompt: 'Test Prompt 2' }, testCoachingId, testUserId);

      const logsResult = await aiService.getUsageLogs(testCoachingId, 10, 0);
      expect(logsResult.total).toBe(2);
      expect(logsResult.logs.length).toBe(2);
      expect(logsResult.logs[0].creditsDeducted).toBe(1);
      expect(logsResult.logs[0].feature).toBe('ai.completion');
      expect(logsResult.logs[0].promptTokens).toBeGreaterThan(0);
      expect(logsResult.logs[0].completionTokens).toBeGreaterThan(0);
    });
  });
});
