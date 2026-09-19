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

  private createDeterministicVector(text: string): number[] {
    const vector = new Array<number>(this.dimension).fill(0);
    const words = text.toLowerCase().match(/\b\w+\b/g) || [text];

    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i);
        hash |= 0;
      }
      const seed = Math.abs(hash);
      for (let j = 0; j < 16; j++) {
        const idx = (seed + j * 97) % this.dimension;
        vector[idx] += 1.0;
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
