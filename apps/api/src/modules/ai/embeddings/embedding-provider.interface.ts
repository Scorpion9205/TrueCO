/**
 * Embedding Provider Interface
 *
 * Defines the contract for converting text chunks and user inquiries
 * into 1536-dimensional vector embeddings for pgvector storage and search.
 */

export interface IEmbeddingProvider {
  readonly providerName: string;
  readonly dimension: number;

  /**
   * Generates a single vector embedding for an input string.
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Generates vector embeddings for a batch of strings in parallel.
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}
