import { assertEmbeddingDimension, EMBEDDING_DIMENSION, IEmbeddingProvider } from './embedding-provider.interface.js';
import { envConfig } from '../../../config/env.config.js';
import { logger } from '../../../common/logger/logger.service.js';

export class GeminiEmbeddingAdapter implements IEmbeddingProvider {
  public readonly providerName = 'GEMINI';
  public readonly dimension = EMBEDDING_DIMENSION;
  public readonly modelId: string;

  public constructor(
    private readonly apiKey: string = (envConfig.get('GEMINI_API_KEY') as string | undefined) || '',
    private readonly model: string = envConfig.get('GEMINI_EMBEDDING_MODEL'),
    private readonly baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta',
  ) {
    this.modelId = `gemini:${model}`;
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    // No silent fallback to mock vectors: mixing them with real ones corrupts search
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/models/${this.model}:embedContent`, {
        method: 'POST',
        // Key in a header, not the URL, so it cannot leak through proxies or error logs
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          model: `models/${this.model}`,
          content: { parts: [{ text }] },
          // Requested natively at 1536 dimensions; never padded or truncated
          outputDimensionality: this.dimension,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini Embedding API request failed (${response.status}): ${errorBody}`);
      }

      const data = (await response.json()) as any;
      return assertEmbeddingDimension(data.embedding?.values || [], 'Gemini');
    } catch (err) {
      logger.error('[GeminiEmbeddingAdapter] Error calling Gemini Embedding API:', err);
      throw err;
    }
  }

  public async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Sequential to stay within rate limits
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.generateEmbedding(text));
    }
    return results;
  }
}
