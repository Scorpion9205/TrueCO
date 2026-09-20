import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InboundWhatsAppWorker, InboundWhatsAppJobPayload } from '../../workers/inbound-whatsapp.worker.js';
import { WhatsAppAssistantService } from '../../modules/whatsapp-assistant/whatsapp-assistant.service.js';

describe('InboundWhatsAppWorker (BullMQ Asynchronous Queue Worker)', () => {
  let mockAssistantService: Partial<WhatsAppAssistantService>;
  let worker: InboundWhatsAppWorker;

  beforeEach(() => {
    mockAssistantService = {
      processInboundMessage: vi.fn().mockResolvedValue({
        to: '+919876543210',
        text: 'Reply from assistant',
        intent: 'RAG_KNOWLEDGE',
      }),
    };

    worker = new InboundWhatsAppWorker(mockAssistantService as WhatsAppAssistantService);
  });

  it('should process inbound job and invoke WhatsAppAssistantService with correct payload', async () => {
    const jobPayload: InboundWhatsAppJobPayload = {
      messageId: 'wamid.HBgL12345',
      from: '+919876543210',
      body: 'What is the refund policy?',
      timestamp: 1726800000,
    };

    const mockJob = {
      id: 'job-1',
      data: jobPayload,
    } as any;

    const result = await worker.processJob(mockJob);

    expect(result).toEqual({ success: true, messageId: 'wamid.HBgL12345' });
    expect(mockAssistantService.processInboundMessage).toHaveBeenCalledTimes(1);
    expect(mockAssistantService.processInboundMessage).toHaveBeenCalledWith({
      messageId: 'wamid.HBgL12345',
      from: '+919876543210',
      body: 'What is the refund policy?',
      timestamp: 1726800000,
    });
  });

  it('should rethrow error if assistant processing fails so BullMQ can retry', async () => {
    (mockAssistantService.processInboundMessage as any).mockRejectedValueOnce(
      new Error('RAG Service Timeout'),
    );

    const mockJob = {
      id: 'job-fail-1',
      data: {
        messageId: 'wamid.FAIL999',
        from: '+919876543210',
        body: 'Failing message',
        timestamp: Date.now(),
      },
    } as any;

    await expect(worker.processJob(mockJob)).rejects.toThrow('RAG Service Timeout');
  });

  it('should allow dynamically swapping assistant service via setAssistantService', async () => {
    const newService = {
      processInboundMessage: vi.fn().mockResolvedValue({
        to: '+919999999999',
        text: 'New service reply',
        intent: 'FEES',
      }),
    } as any;

    worker.setAssistantService(newService);

    const mockJob = {
      id: 'job-swap-1',
      data: {
        messageId: 'wamid.SWAP123',
        from: '+919999999999',
        body: 'fee dues',
        timestamp: Date.now(),
      },
    } as any;

    const result = await worker.processJob(mockJob);

    expect(result.success).toBe(true);
    expect(newService.processInboundMessage).toHaveBeenCalledTimes(1);
    expect(mockAssistantService.processInboundMessage).not.toHaveBeenCalled();
  });
});
