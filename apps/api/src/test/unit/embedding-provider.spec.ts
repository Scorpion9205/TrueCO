import { describe, it, expect } from 'vitest';
import { MockEmbeddingProvider } from '../../modules/ai/embeddings/mock-embedding.provider.js';
import { EmbeddingProviderFactory } from '../../modules/ai/embeddings/embedding-provider.factory.js';

describe('Embedding Providers', () => {
  it('MockEmbeddingProvider should generate a 1536-dimensional vector', async () => {
    const provider = new MockEmbeddingProvider();
    expect(provider.dimension).toBe(1536);

    const embedding = await provider.generateEmbedding('Admissions are open for Class 10 Foundation Batch.');
    expect(embedding).toHaveLength(1536);

    // Verify values are valid floating point numbers
    for (const val of embedding.slice(0, 10)) {
      expect(typeof val).toBe('number');
      expect(Number.isFinite(val)).toBe(true);
    }
  });

  it('MockEmbeddingProvider should generate batch embeddings preserving order', async () => {
    const provider = new MockEmbeddingProvider();
    const texts = [
      'Query 1: What is the fee structure?',
      'Query 2: What are batch timings?',
      'Query 3: How to apply for refund?',
    ];

    const embeddings = await provider.generateEmbeddings(texts);
    expect(embeddings).toHaveLength(3);
    expect(embeddings[0]).toHaveLength(1536);
    expect(embeddings[1]).toHaveLength(1536);
    expect(embeddings[2]).toHaveLength(1536);

    // Identical texts produce identical embeddings (deterministic property)
    const repeat = await provider.generateEmbedding('Query 1: What is the fee structure?');
    expect(embeddings[0]).toEqual(repeat);
  });

  it('MockEmbeddingProvider should produce normalized unit vectors (L2 norm ≈ 1.0)', async () => {
    const provider = new MockEmbeddingProvider();
    const vec = await provider.generateEmbedding('Testing Euclidean norm for cosine similarity property.');

    const norm = Math.sqrt(vec.reduce((acc, val) => acc + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 2);
  });

  it('EmbeddingProviderFactory should return a valid provider instance', () => {
    const factory = EmbeddingProviderFactory.getInstance();
    const mockProvider = factory.getProvider('MOCK');

    expect(mockProvider.providerName).toBe('MOCK');
    expect(mockProvider.dimension).toBe(1536);
  });
});
