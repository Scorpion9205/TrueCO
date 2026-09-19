import { IEmbeddingProvider } from './embedding-provider.interface.js';

/**
 * Mock Embedding Provider
 *
 * Produces deterministic, normalized 1536-dimensional float vectors
 * based on input text hashing. Enables 100% offline, hermetic testing
 * with true cosine similarity properties.
 */
export class MockEmbeddingProvider implements IEmbeddingProvider {
  public readonly providerName = 'MOCK';
  public readonly dimension = 1536;

  public async generateEmbedding(text: string): Promise<number[]> {
    return this.createDeterministicVector(text);
  }

  public async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.createDeterministicVector(t));
  }

  private static readonly STOP_WORDS = new Set([
    'is', 'are', 'am', 'was', 'were', 'the', 'a', 'an', 'in', 'on', 'at',
    'to', 'for', 'of', 'and', 'or', 'by', 'with', 'from', 'as', 'it',
    'this', 'that', 'we', 'you', 'your', 'my', 'our', 'if', 'what', 'when',
    'where', 'how', 'who', 'which', 'can', 'will', 'do', 'does', 'did',
  ]);

  private createDeterministicVector(text: string): number[] {
    const vector = new Array<number>(this.dimension).fill(0);
    const words = text.toLowerCase().match(/\b\w+\b/g) || [text];

    for (const rawWord of words) {
      if (MockEmbeddingProvider.STOP_WORDS.has(rawWord)) {
        continue;
      }

      const tokens = [{ text: rawWord, weight: 2.0 }];
      if (rawWord.length >= 4) {
        for (let len = 3; len <= Math.min(rawWord.length, 5); len++) {
          tokens.push({ text: rawWord.substring(0, len), weight: 1.0 });
        }
      }

      for (const item of tokens) {
        let hash = 0;
        for (let i = 0; i < item.text.length; i++) {
          hash = (hash << 5) - hash + item.text.charCodeAt(i);
          hash |= 0;
        }
        const seed = Math.abs(hash);
        for (let j = 0; j < 4; j++) {
          const idx = (seed + j * 157) % this.dimension;
          vector[idx] += item.weight;
        }
      }
    }

    let sumSquares = 0;
    for (let i = 0; i < this.dimension; i++) {
      sumSquares += vector[i] * vector[i];
    }

    const norm = Math.sqrt(sumSquares) || 1.0;
    for (let i = 0; i < this.dimension; i++) {
      vector[i] = Number((vector[i] / norm).toFixed(6));
    }

    return vector;
  }
}
