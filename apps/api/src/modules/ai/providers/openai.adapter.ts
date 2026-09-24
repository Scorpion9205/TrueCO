import { AiProviderType } from '@trueco/types';
import {
  AiCompletionOptions,
  AiCompletionResult,
  IAiProvider,
} from './ai-provider.interface.js';
import { envConfig } from '../../../config/env.config.js';
import { logger } from '../../../common/logger/logger.service.js';
import { MockAiProvider } from './mock-ai.provider.js';

export class OpenAiAdapter implements IAiProvider {
  public readonly providerType: AiProviderType = AiProviderType.OPENAI;
  private readonly defaultModel = envConfig.get('AI_MODEL_OPENAI');
  private readonly fallbackMock = new MockAiProvider();

  public constructor(
    private readonly apiKey: string = (envConfig.get('OPENAI_API_KEY') as string | undefined) || '',
    private readonly baseUrl: string = 'https://api.openai.com/v1',
  ) {}

  public async generateCompletion(
    options: AiCompletionOptions,
  ): Promise<AiCompletionResult> {
    if (!this.apiKey) {
      // A mock answer in production would be shown to parents and charged as credits
      if (envConfig.get('NODE_ENV') === 'production') {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      logger.warn('[OpenAiAdapter] OPENAI_API_KEY not configured. Falling back to MockAiProvider');
      return this.fallbackMock.generateCompletion(options);
    }

    const model = options.model || this.defaultModel;
    const messages: Array<{ role: string; content: string }> = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.prompt });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 1000,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI API request failed (${response.status}): ${errorBody}`);
      }

      const data = (await response.json()) as any;
      const choice = data.choices?.[0];
      const content = choice?.message?.content || '';
      const usage = data.usage || {};

      return {
        content,
        provider: this.providerType,
        model,
        promptTokens: usage.prompt_tokens || Math.ceil(options.prompt.length / 4),
        completionTokens: usage.completion_tokens || Math.ceil(content.length / 4),
        totalTokens: usage.total_tokens || 0,
      };
    } catch (err) {
      logger.error('[OpenAiAdapter] Error calling OpenAI API:', err);
      throw err;
    }
  }
}
