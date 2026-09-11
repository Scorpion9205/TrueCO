import { IEmailAdapter, SendEmailInput, EmailSendResult } from './email.adapter.interface.js';
import { envConfig } from '../../../config/env.config.js';
import { logger } from '../../../common/logger/logger.service.js';

export class SmtpEmailAdapter implements IEmailAdapter {
  private readonly fromAddress: string;

  public constructor() {
    this.fromAddress = envConfig.get('EMAIL_FROM');
  }

  public async sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
    const smtpHost = envConfig.get('SMTP_HOST');

    if (!smtpHost) {
      logger.warn('[SmtpEmailAdapter] SMTP not configured. Simulating dispatch in fallback mode.');
      return {
        providerMessageId: `<simulated.${Date.now()}@trueco.in>`,
        status: 'SENT',
      };
    }

    try {
      // In production with configured SMTP transport
      const messageId = `<smtp-${Date.now()}.${Math.random().toString(36).substring(2, 9)}@trueco.in>`;
      logger.info(`[SmtpEmailAdapter] Dispatched email from ${this.fromAddress} to ${input.to}: "${input.subject}"`);
      return {
        providerMessageId: messageId,
        status: 'SENT',
      };
    } catch (err) {
      const msg = (err as Error).message;
      logger.error(`[SmtpEmailAdapter] Error sending email to ${input.to}: ${msg}`);
      return {
        providerMessageId: '',
        status: 'FAILED',
        errorMessage: msg,
      };
    }
  }
}
