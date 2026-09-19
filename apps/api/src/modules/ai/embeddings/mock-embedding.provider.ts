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
    const vector = new Array<number>(this.dimension);
    let hash = 0;

    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    let sumSquares = 0;
    for (let i = 0; i < this.dimension; i++) {
      const val = Math.sin((hash + 1) * (i + 1));
      vector[i] = val;
      sumSquares += val * val;
    }

    // Normalize to unit length (Euclidean norm = 1.0) so dot product equals cosine similarity
    const norm = Math.sqrt(sumSquares) || 1.0;
    for (let i = 0; i < this.dimension; i++) {
      vector[i] = Number((vector[i] / norm).toFixed(6));
    }

    return vector;
  }
}
