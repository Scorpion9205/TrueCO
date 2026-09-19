import { IEmbeddingProvider } from './embedding-provider.interface.js';
import { envConfig } from '../../../config/env.config.js';
import { logger } from '../../../common/logger/logger.service.js';
import { MockEmbeddingProvider } from './mock-embedding.provider.js';

export class OpenAiEmbeddingAdapter implements IEmbeddingProvider {
  public readonly providerName = 'OPENAI';
  public readonly dimension = 1536;
  private readonly defaultModel = 'text-embedding-3-small';
  private readonly fallbackMock = new MockEmbeddingProvider();

  public constructor(
    private readonly apiKey: string = (envConfig.get('OPENAI_API_KEY') as string | undefined) || '',
    private readonly baseUrl: string = 'https://api.openai.com/v1',
  ) {}

  public async generateEmbedding(text: string): Promise<number[]> {
    const [embedding] = await this.generateEmbeddings([text]);
    return embedding;
  }

  public async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (!this.apiKey) {
      logger.warn('[OpenAiEmbeddingAdapter] OPENAI_API_KEY not configured. Falling back to MockEmbeddingProvider');
      return this.fallbackMock.generateEmbeddings(texts);
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.defaultModel,
          input: texts,
          dimensions: this.dimension,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI Embeddings request failed (${response.status}): ${errorBody}`);
      }

      const data = (await response.json()) as any;
      const sortedData = (data.data || []).sort((a: any, b: any) => a.index - b.index);

      return sortedData.map((item: any) => item.embedding as number[]);
    } catch (err) {
      logger.error('[OpenAiEmbeddingAdapter] Error calling OpenAI Embeddings API:', err);
      throw err;
    }
  }
}
