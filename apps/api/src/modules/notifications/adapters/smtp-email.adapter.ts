import nodemailer, { Transporter } from 'nodemailer';
import { IEmailAdapter, SendEmailInput, EmailSendResult } from './email.adapter.interface.js';
import { envConfig } from '../../../config/env.config.js';
import { logger } from '../../../common/logger/logger.service.js';

export class SmtpEmailAdapter implements IEmailAdapter {
  private readonly fromAddress: string;
  private transporter: Transporter | null = null;

  public constructor(transporter?: Transporter) {
    this.fromAddress = envConfig.get('EMAIL_FROM');
    this.transporter = transporter ?? null;
  }

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;
    const host = envConfig.get('SMTP_HOST');
    if (!host) return null;

    const user = envConfig.get('SMTP_USER');
    this.transporter = nodemailer.createTransport({
      host,
      port: envConfig.get('SMTP_PORT'),
      secure: envConfig.get('SMTP_SECURE'),
      auth: user ? { user, pass: envConfig.get('SMTP_PASS') } : undefined,
    });
    return this.transporter;
  }

  public async sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
    const transporter = this.getTransporter();

    if (!transporter) {
      // Reporting "sent" for mail that never left would hide a misconfiguration from everyone
      if (envConfig.get('NODE_ENV') === 'production') {
        logger.error('[SmtpEmailAdapter] SMTP_HOST is not configured; email not sent', undefined, {
          to: input.to,
          subject: input.subject,
        });
        return { providerMessageId: '', status: 'FAILED', errorMessage: 'Email delivery is not configured' };
      }
      logger.warn(`[SmtpEmailAdapter] SMTP not configured; simulating email to ${input.to}: "${input.subject}"`);
      return { providerMessageId: `<simulated.${Date.now()}@vargly.in>`, status: 'SENT' };
    }

    try {
      const info = await transporter.sendMail({
        from: this.fromAddress,
        to: input.to,
        subject: input.subject,
        html: input.htmlBody,
        text: input.textBody,
      });
      logger.info(`[SmtpEmailAdapter] Sent email to ${input.to}: "${input.subject}"`, { messageId: info.messageId });
      return { providerMessageId: info.messageId, status: 'SENT' };
    } catch (err) {
      const msg = (err as Error).message;
      logger.error(`[SmtpEmailAdapter] Error sending email to ${input.to}: ${msg}`);
      return { providerMessageId: '', status: 'FAILED', errorMessage: msg };
    }
  }
}
