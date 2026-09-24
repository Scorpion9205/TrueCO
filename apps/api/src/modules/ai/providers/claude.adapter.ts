import { AiProviderType } from '@trueco/types';
import {
  AiCompletionOptions,
  AiCompletionResult,
  IAiProvider,
} from './ai-provider.interface.js';
import { envConfig } from '../../../config/env.config.js';
import { logger } from '../../../common/logger/logger.service.js';
import { MockAiProvider } from './mock-ai.provider.js';

export class ClaudeAiAdapter implements IAiProvider {
  public readonly providerType: AiProviderType = AiProviderType.CLAUDE;
  private readonly defaultModel = envConfig.get('AI_MODEL_CLAUDE');
  private readonly fallbackMock = new MockAiProvider();

  public constructor(
    private readonly apiKey: string = (envConfig.get('ANTHROPIC_API_KEY') as string | undefined) || '',
    private readonly baseUrl: string = 'https://api.anthropic.com/v1',
  ) {}

  public async generateCompletion(
    options: AiCompletionOptions,
  ): Promise<AiCompletionResult> {
    if (!this.apiKey) {
      // A mock answer in production would be shown to parents and charged as credits
      if (envConfig.get('NODE_ENV') === 'production') {
        throw new Error('ANTHROPIC_API_KEY is not configured');
      }
      logger.warn('[ClaudeAiAdapter] ANTHROPIC_API_KEY not configured. Falling back to MockAiProvider');
      return this.fallbackMock.generateCompletion(options);
    }

    const model = options.model || this.defaultModel;

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          system: options.systemPrompt,
          messages: [{ role: 'user', content: options.prompt }],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 1000,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Claude API request failed (${response.status}): ${errorBody}`);
      }

      const data = (await response.json()) as any;
      // A reply can hold several content blocks; join the text ones
      const content = (data.content ?? [])
        .filter((block: any) => block?.type === 'text')
        .map((block: any) => block.text)
        .join('');
      const usage = data.usage || {};

      return {
        content,
        provider: this.providerType,
        model,
        promptTokens: usage.input_tokens || Math.ceil(options.prompt.length / 4),
        completionTokens: usage.output_tokens || Math.ceil(content.length / 4),
        totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      };
    } catch (err) {
      logger.error('[ClaudeAiAdapter] Error calling Anthropic API:', err);
      throw err;
    }
  }
}
