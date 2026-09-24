import { IEmailAdapter } from '../notifications/adapters/email.adapter.interface.js';
import { SmtpEmailAdapter } from '../notifications/adapters/smtp-email.adapter.js';
import { envConfig } from '../../config/env.config.js';

/** Delivers account emails that carry single-use links (password reset, email verification). */
export interface IAuthMailer {
  sendPasswordReset(to: string, token: string): Promise<void>;
  sendEmailVerification(to: string, token: string): Promise<void>;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export class EmailAuthMailer implements IAuthMailer {
  public constructor(
    private readonly email: IEmailAdapter = new SmtpEmailAdapter(),
    private readonly frontendUrl: string = envConfig.get('FRONTEND_URL'),
  ) {}

  public async sendPasswordReset(to: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.send(
      to,
      'Reset your TrueCO password',
      'We received a request to reset your TrueCO password. This link works once and expires in 1 hour.',
      'Reset password',
      link,
      "If you didn't ask for this, you can ignore this email; your password stays the same.",
    );
  }

  public async sendEmailVerification(to: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await this.send(
      to,
      'Verify your email for TrueCO',
      'Please confirm this email address for your TrueCO account. The link expires in 48 hours.',
      'Verify email',
      link,
      "If you didn't create a TrueCO account, you can ignore this email.",
    );
  }

  private async send(to: string, subject: string, intro: string, action: string, link: string, footer: string): Promise<void> {
    const result = await this.email.sendEmail({
      to,
      subject,
      coachingId: 'platform',
      textBody: `${intro}\n\n${action}: ${link}\n\n${footer}`,
      htmlBody:
        `<p>${escapeHtml(intro)}</p>` +
        `<p><a href="${escapeHtml(link)}">${escapeHtml(action)}</a></p>` +
        `<p style="color:#666">${escapeHtml(footer)}</p>`,
    });
    if (result.status !== 'SENT') {
      throw new Error(result.errorMessage || 'Email delivery failed');
    }
  }
}
