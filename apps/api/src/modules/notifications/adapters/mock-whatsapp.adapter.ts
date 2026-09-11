import { IWhatsAppAdapter, SendWhatsAppInput, WhatsAppSendResult } from './whatsapp.adapter.interface.js';
import { logger } from '../../../common/logger/logger.service.js';

export class MockWhatsAppAdapter implements IWhatsAppAdapter {
  public readonly sentMessages: Array<{ input: SendWhatsAppInput; sentAt: Date; messageId: string }> = [];

  public async sendMessage(input: SendWhatsAppInput): Promise<WhatsAppSendResult> {
    const providerMessageId = `wamid.${Date.now()}.${Math.random().toString(36).substring(2, 9)}`;

    logger.info(`[MockWhatsAppAdapter] Simulating WhatsApp dispatch to ${input.to}: template=${input.templateName || 'custom_text'}`);
    logger.debug(`[MockWhatsAppAdapter] Content payload:`, { input, providerMessageId });

    this.sentMessages.push({
      input,
      sentAt: new Date(),
      messageId: providerMessageId,
    });

    return {
      providerMessageId,
      status: 'SENT',
    };
  }
}
