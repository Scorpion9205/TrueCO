import { AiProviderType } from '@trueco/types';
import {
  AiCompletionOptions,
  AiCompletionResult,
  IAiProvider,
} from './ai-provider.interface.js';
import { envConfig } from '../../../config/env.config.js';
import { logger } from '../../../common/logger/logger.service.js';
import { MockAiProvider } from './mock-ai.provider.js';

export class GeminiAiAdapter implements IAiProvider {
  public readonly providerType: AiProviderType = AiProviderType.GEMINI;
  private readonly defaultModel = envConfig.get('AI_MODEL_GEMINI');
  private readonly fallbackMock = new MockAiProvider();

  public constructor(
    private readonly apiKey: string = (envConfig.get('GEMINI_API_KEY') as string | undefined) || '',
    private readonly baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta',
  ) {}

  public async generateCompletion(
    options: AiCompletionOptions,
  ): Promise<AiCompletionResult> {
    if (!this.apiKey) {
      // A mock answer in production would be shown to parents and charged as credits
      if (envConfig.get('NODE_ENV') === 'production') {
        throw new Error('GEMINI_API_KEY is not configured');
      }
      logger.warn('[GeminiAiAdapter] GEMINI_API_KEY not configured. Falling back to MockAiProvider');
      return this.fallbackMock.generateCompletion(options);
    }

    const model = options.model || this.defaultModel;

    try {
      const url = `${this.baseUrl}/models/${model}:generateContent`;
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      if (options.systemPrompt) {
        contents.push({
          role: 'user',
          parts: [{ text: `System Instruction: ${options.systemPrompt}` }],
        });
      }
      contents.push({
        role: 'user',
        parts: [{ text: options.prompt }],
      });

      const response = await fetch(url, {
        method: 'POST',
        // Key in a header, not the URL, so it cannot leak through proxies or error logs
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 1000,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API request failed (${response.status}): ${errorBody}`);
      }

      const data = (await response.json()) as any;
      const candidate = data.candidates?.[0];
      const content = candidate?.content?.parts?.[0]?.text || '';
      const usage = data.usageMetadata || {};

      return {
        content,
        provider: this.providerType,
        model,
        promptTokens: usage.promptTokenCount || Math.ceil(options.prompt.length / 4),
        completionTokens: usage.candidatesTokenCount || Math.ceil(content.length / 4),
        totalTokens: usage.totalTokenCount || 0,
      };
    } catch (err) {
      logger.error('[GeminiAiAdapter] Error calling Gemini API:', err);
      throw err;
    }
  }
}
