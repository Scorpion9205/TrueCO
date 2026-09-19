import { IEmbeddingProvider } from './embedding-provider.interface.js';
import { envConfig } from '../../../config/env.config.js';
import { logger } from '../../../common/logger/logger.service.js';
import { MockEmbeddingProvider } from './mock-embedding.provider.js';

export class GeminiEmbeddingAdapter implements IEmbeddingProvider {
  public readonly providerName = 'GEMINI';
  public readonly dimension = 1536;
  private readonly defaultModel = 'text-embedding-004';
  private readonly fallbackMock = new MockEmbeddingProvider();

  public constructor(
    private readonly apiKey: string = (envConfig.get('GEMINI_API_KEY') as string | undefined) || '',
    private readonly baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta',
  ) {}

  public async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      logger.warn('[GeminiEmbeddingAdapter] GEMINI_API_KEY not configured. Falling back to MockEmbeddingProvider');
      return this.fallbackMock.generateEmbedding(text);
    }

    try {
      const url = `${this.baseUrl}/models/${this.defaultModel}:embedContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${this.defaultModel}`,
          content: { parts: [{ text }] },
          outputDimensionality: this.dimension,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini Embedding API request failed (${response.status}): ${errorBody}`);
      }

      const data = (await response.json()) as any;
      const values = data.embedding?.values || [];

      // Ensure 1536 dimensions
      if (values.length < this.dimension) {
        return [...values, ...new Array(this.dimension - values.length).fill(0)];
      }
      return values.slice(0, this.dimension);
    } catch (err) {
      logger.error('[GeminiEmbeddingAdapter] Error calling Gemini Embedding API:', err);
      throw err;
    }
  }

  public async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (!this.apiKey) {
      logger.warn('[GeminiEmbeddingAdapter] GEMINI_API_KEY not configured. Falling back to MockEmbeddingProvider');
      return this.fallbackMock.generateEmbeddings(texts);
    }

    // Process sequentially or in small parallel chunks to avoid rate limits
    const results: number[][] = [];
    for (const text of texts) {
      const vec = await this.generateEmbedding(text);
      results.push(vec);
    }
    return results;
  }
}
