/**
 * Embedding Provider Interface
 *
 * Converts text chunks and user inquiries into 1536-dimensional vectors for pgvector storage
 * and search. Vectors are only comparable within one model, so every provider reports the
 * model it uses (`modelId`) and stored chunks are tagged with it.
 */

export const EMBEDDING_DIMENSION = 1536;

export interface IEmbeddingProvider {
  readonly providerName: string;
  readonly dimension: number;
  /** Stable identity of the embedding model, e.g. "openai:text-embedding-3-small". */
  readonly modelId: string;

  /**
   * Generates a single vector embedding for an input string.
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Generates vector embeddings for a batch of strings.
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

/** Rejects vectors of the wrong size instead of padding or truncating them into nonsense. */
export function assertEmbeddingDimension(vector: number[], provider: string): number[] {
  if (vector.length !== EMBEDDING_DIMENSION) {
    throw new Error(`${provider} returned a ${vector.length}-dimensional embedding; expected ${EMBEDDING_DIMENSION}`);
  }
  return vector;
}
