export interface SendEmailInput {
  readonly to: string;
  readonly subject: string;
  readonly htmlBody: string;
  readonly textBody?: string;
  readonly coachingId: string;
}

export interface EmailSendResult {
  readonly providerMessageId: string;
  readonly status: 'SENT' | 'FAILED';
  readonly errorMessage?: string;
}

export interface IEmailAdapter {
  sendEmail(input: SendEmailInput): Promise<EmailSendResult>;
}
