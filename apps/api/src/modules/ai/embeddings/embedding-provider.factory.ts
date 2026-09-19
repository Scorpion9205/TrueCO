import { IEmbeddingProvider } from './embedding-provider.interface.js';
import { OpenAiEmbeddingAdapter } from './openai-embedding.adapter.js';
import { GeminiEmbeddingAdapter } from './gemini-embedding.adapter.js';
import { MockEmbeddingProvider } from './mock-embedding.provider.js';
import { envConfig } from '../../../config/env.config.js';

export class EmbeddingProviderFactory {
  private static instance: EmbeddingProviderFactory;
  private readonly defaultProvider: IEmbeddingProvider;

  private constructor() {
    const hasOpenAi = Boolean(envConfig.get('OPENAI_API_KEY'));
    const hasGemini = Boolean(envConfig.get('GEMINI_API_KEY'));

    if (hasOpenAi) {
      this.defaultProvider = new OpenAiEmbeddingAdapter();
    } else if (hasGemini) {
      this.defaultProvider = new GeminiEmbeddingAdapter();
    } else {
      this.defaultProvider = new MockEmbeddingProvider();
    }
  }

  public static getInstance(): EmbeddingProviderFactory {
    if (!EmbeddingProviderFactory.instance) {
      EmbeddingProviderFactory.instance = new EmbeddingProviderFactory();
    }
    return EmbeddingProviderFactory.instance;
  }

  public getProvider(preferred?: 'OPENAI' | 'GEMINI' | 'MOCK'): IEmbeddingProvider {
    if (preferred === 'OPENAI') return new OpenAiEmbeddingAdapter();
    if (preferred === 'GEMINI') return new GeminiEmbeddingAdapter();
    if (preferred === 'MOCK') return new MockEmbeddingProvider();
    return this.defaultProvider;
  }
}

export const embeddingProviderFactory = EmbeddingProviderFactory.getInstance();
