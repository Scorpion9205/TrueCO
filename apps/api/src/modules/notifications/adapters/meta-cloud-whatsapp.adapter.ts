import { IWhatsAppAdapter, SendWhatsAppInput, WhatsAppSendResult } from './whatsapp.adapter.interface.js';
import { envConfig } from '../../../config/env.config.js';
import { logger } from '../../../common/logger/logger.service.js';

export class MetaCloudWhatsAppAdapter implements IWhatsAppAdapter {
  private readonly phoneNumberId?: string;
  private readonly apiToken?: string;
  private readonly apiVersion: string;

  public constructor() {
    this.phoneNumberId = envConfig.get('WHATSAPP_PHONE_NUMBER_ID');
    this.apiToken = envConfig.get('WHATSAPP_API_TOKEN');
    this.apiVersion = envConfig.get('WHATSAPP_API_VERSION') || 'v19.0';
  }

  public async sendMessage(input: SendWhatsAppInput): Promise<WhatsAppSendResult> {
    if (!this.phoneNumberId || !this.apiToken) {
      // Reporting "sent" for messages that never left would hide a misconfiguration from
      // everyone; outside production the dispatch is simulated for local development.
      if (envConfig.get('NODE_ENV') === 'production') {
        logger.error('[MetaCloudWhatsAppAdapter] WhatsApp credentials are not configured; message not sent');
        return { providerMessageId: '', status: 'FAILED', errorMessage: 'WhatsApp delivery is not configured' };
      }
      logger.warn('[MetaCloudWhatsAppAdapter] WhatsApp API credentials not configured. Simulating dispatch.');
      return {
        providerMessageId: `wamid.simulated.${Date.now()}`,
        status: 'SENT',
      };
    }

    const cleanPhone = input.to.replace(/\D/g, ''); // strip non-digits for Meta format
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    let payload: Record<string, unknown>;

    if (input.templateName) {
      // Template message
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'template',
        template: {
          name: input.templateName,
          language: { code: input.templateLanguage || 'en' },
          ...(input.templateVariables && {
            components: [
              {
                type: 'body',
                parameters: Object.entries(input.templateVariables).map(([_, text]) => ({
                  type: 'text',
                  text,
                })),
              },
            ],
          }),
        },
      };
    } else {
      // Standard text message
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: input.bodyText || '',
        },
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseBody = (await response.json()) as any;

      if (!response.ok) {
        const errorMsg = responseBody?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        logger.error(`[MetaCloudWhatsAppAdapter] Meta API error sending to ${input.to}: ${errorMsg}`);
        return {
          providerMessageId: '',
          status: 'FAILED',
          errorMessage: errorMsg,
        };
      }

      const providerMessageId = responseBody?.messages?.[0]?.id || `wamid.${Date.now()}`;
      return {
        providerMessageId,
        status: 'SENT',
      };
    } catch (err) {
      const msg = (err as Error).message;
      logger.error(`[MetaCloudWhatsAppAdapter] Network error sending to ${input.to}: ${msg}`);
      return {
        providerMessageId: '',
        status: 'FAILED',
        errorMessage: msg,
      };
    }
  }
}
