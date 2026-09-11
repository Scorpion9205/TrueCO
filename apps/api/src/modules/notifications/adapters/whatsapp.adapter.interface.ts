export interface SendWhatsAppInput {
  readonly to: string; // E.164 phone number, e.g. "+919876543210"
  readonly coachingId: string;
  readonly templateName?: string;
  readonly templateLanguage?: string;
  readonly templateVariables?: Record<string, string>;
  readonly bodyText?: string;
  readonly mediaUrl?: string;
}

export interface WhatsAppSendResult {
  readonly providerMessageId: string;
  readonly status: 'SENT' | 'FAILED';
  readonly errorMessage?: string;
}

export interface IWhatsAppAdapter {
  sendMessage(input: SendWhatsAppInput): Promise<WhatsAppSendResult>;
}
