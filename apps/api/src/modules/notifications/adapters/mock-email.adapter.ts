import { IEmailAdapter, SendEmailInput, EmailSendResult } from './email.adapter.interface.js';
import { logger } from '../../../common/logger/logger.service.js';

export class MockEmailAdapter implements IEmailAdapter {
  public readonly sentEmails: Array<{ input: SendEmailInput; sentAt: Date; messageId: string }> = [];

  public async sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
    const providerMessageId = `<mock-email-${Date.now()}.${Math.random().toString(36).substring(2, 9)}@trueco.in>`;

    logger.info(`[MockEmailAdapter] Simulating email dispatch to ${input.to}: "${input.subject}"`);
    logger.debug(`[MockEmailAdapter] HTML body length: ${input.htmlBody.length} bytes`);

    this.sentEmails.push({
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
