import { AiProviderType } from '@trueco/types';
import {
  IAiProvider,
  IAiProviderFactory,
} from './ai-provider.interface.js';
import { OpenAiAdapter } from './openai.adapter.js';
import { ClaudeAiAdapter } from './claude.adapter.js';
import { GeminiAiAdapter } from './gemini.adapter.js';
import { MockAiProvider } from './mock-ai.provider.js';

export class AiProviderFactory implements IAiProviderFactory {
  private readonly providers: Map<AiProviderType, IAiProvider> = new Map();

  public constructor(customProviders?: Partial<Record<AiProviderType, IAiProvider>>) {
    this.providers.set(AiProviderType.OPENAI, customProviders?.OPENAI || new OpenAiAdapter());
    this.providers.set(AiProviderType.CLAUDE, customProviders?.CLAUDE || new ClaudeAiAdapter());
    this.providers.set(AiProviderType.GEMINI, customProviders?.GEMINI || new GeminiAiAdapter());
  }

  public getProvider(providerType: AiProviderType = AiProviderType.OPENAI): IAiProvider {
    const provider = this.providers.get(providerType);
    if (!provider) {
      return this.providers.get(AiProviderType.OPENAI) || new MockAiProvider();
    }
    return provider;
  }
}
