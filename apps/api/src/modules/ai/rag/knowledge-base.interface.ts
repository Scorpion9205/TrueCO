export type KnowledgeType = 'FAQ' | 'POLICY' | 'SYLLABUS' | 'SCHEDULE' | 'GENERAL_NOTICE';

export interface KnowledgeBaseEntity {
  readonly id: string;
  readonly coachingId: string;
  readonly title: string;
  readonly type: KnowledgeType;
  readonly description?: string | null;
  readonly sourceUrl?: string | null;
  readonly rawContent: string;
  readonly characterCount: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface KnowledgeChunkEntity {
  readonly id: string;
  readonly coachingId: string;
  readonly knowledgeBaseId: string;
  readonly chunkIndex: number;
  readonly content: string;
  readonly tokenCount: number;
  readonly metadata?: Record<string, unknown> | null;
  readonly similarity?: number;
}

export interface CreateKnowledgeBaseDto {
  readonly title: string;
  readonly type?: KnowledgeType;
  readonly rawContent: string;
  readonly description?: string;
  readonly sourceUrl?: string;
}

export interface SearchKnowledgeQuery {
  readonly queryVector: number[];
  /** Only chunks embedded by this model are compared with the query vector. */
  readonly embeddingModel: string;
  readonly coachingId: string;
  readonly limit?: number;
  readonly threshold?: number; // Minimum cosine similarity (e.g., 0.60 to 1.0)
  readonly textQuery?: string;
}

export interface IKnowledgeBaseRepository {
  createDocument(data: CreateKnowledgeBaseDto, coachingId: string): Promise<KnowledgeBaseEntity>;
  findById(id: string, coachingId: string): Promise<KnowledgeBaseEntity | null>;
  listByCoaching(coachingId: string, limit?: number, offset?: number): Promise<KnowledgeBaseEntity[]>;
  insertChunks(
    chunks: Array<{
      coachingId: string;
      knowledgeBaseId: string;
      chunkIndex: number;
      content: string;
      tokenCount: number;
      metadata?: Record<string, unknown>;
      vector: number[];
      embeddingModel: string;
    }>,
  ): Promise<void>;
  searchSimilarChunks(options: SearchKnowledgeQuery): Promise<KnowledgeChunkEntity[]>;
  deleteDocument(id: string, coachingId: string): Promise<boolean>;
  /**
   * Live documents, across coachings, with no active chunks from this embedding model (added
   * while no model was configured, or embedded by an earlier one). Oldest first.
   */
  findDocumentsNeedingEmbedding(embeddingModel: string, limit: number): Promise<KnowledgeBaseEntity[]>;
  /** Retires a document's chunks, so fresh ones can replace them */
  deactivateChunks(knowledgeBaseId: string): Promise<void>;
}
