import {
  IKnowledgeBaseRepository,
  KnowledgeBaseEntity,
  KnowledgeChunkEntity,
  CreateKnowledgeBaseDto,
  SearchKnowledgeQuery,
} from '../../modules/ai/rag/knowledge-base.interface.js';

interface StoredChunk {
  id: string;
  coachingId: string;
  knowledgeBaseId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata?: Record<string, unknown>;
  vector: number[];
  isActive: boolean;
}

export class InMemoryKnowledgeBaseRepository implements IKnowledgeBaseRepository {
  private readonly documents: Map<string, KnowledgeBaseEntity> = new Map();
  private readonly chunks: Map<string, StoredChunk> = new Map();

  public async createDocument(
    data: CreateKnowledgeBaseDto,
    coachingId: string,
  ): Promise<KnowledgeBaseEntity> {
    const doc: KnowledgeBaseEntity = {
      id: crypto.randomUUID(),
      coachingId,
      title: data.title,
      type: data.type || 'FAQ',
      description: data.description || null,
      sourceUrl: data.sourceUrl || null,
      rawContent: data.rawContent,
      characterCount: data.rawContent.length,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.documents.set(doc.id, doc);
    return doc;
  }

  public async findById(id: string, coachingId: string): Promise<KnowledgeBaseEntity | null> {
    const doc = this.documents.get(id);
    return doc && doc.coachingId === coachingId && doc.isActive ? doc : null;
  }

  public async listByCoaching(
    coachingId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<KnowledgeBaseEntity[]> {
    return Array.from(this.documents.values())
      .filter((d) => d.coachingId === coachingId && d.isActive)
      .slice(offset, offset + limit);
  }

  public async insertChunks(
    chunks: Array<{
      coachingId: string;
      knowledgeBaseId: string;
      chunkIndex: number;
      content: string;
      tokenCount: number;
      metadata?: Record<string, unknown>;
      vector: number[];
    }>,
  ): Promise<void> {
    for (const c of chunks) {
      const id = crypto.randomUUID();
      this.chunks.set(id, {
        id,
        coachingId: c.coachingId,
        knowledgeBaseId: c.knowledgeBaseId,
        chunkIndex: c.chunkIndex,
        content: c.content,
        tokenCount: c.tokenCount,
        metadata: c.metadata,
        vector: c.vector,
        isActive: true,
      });
    }
  }

  public async searchSimilarChunks(options: SearchKnowledgeQuery): Promise<KnowledgeChunkEntity[]> {
    const threshold = options.threshold ?? 0.6;
    const limit = options.limit ?? 4;
    const matches: Array<KnowledgeChunkEntity & { similarity: number }> = [];

    for (const chunk of this.chunks.values()) {
      if (chunk.coachingId !== options.coachingId || !chunk.isActive) {
        continue;
      }

      const similarity = this.cosineSimilarity(options.queryVector, chunk.vector);
      if (similarity >= threshold) {
        matches.push({
          id: chunk.id,
          coachingId: chunk.coachingId,
          knowledgeBaseId: chunk.knowledgeBaseId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          metadata: chunk.metadata,
          similarity: Number(similarity.toFixed(4)),
        });
      }
    }

    matches.sort((a, b) => b.similarity - a.similarity);
    return matches.slice(0, limit);
  }

  public async deleteDocument(id: string, coachingId: string): Promise<boolean> {
    const doc = this.documents.get(id);
    if (!doc || doc.coachingId !== coachingId) return false;

    this.documents.delete(id);

    for (const [chunkId, chunk] of this.chunks.entries()) {
      if (chunk.knowledgeBaseId === id) {
        this.chunks.delete(chunkId);
      }
    }

    return true;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
