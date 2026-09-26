import {
  IKnowledgeBaseRepository,
  KnowledgeBaseEntity,
  KnowledgeChunkEntity,
  CreateKnowledgeBaseDto,
} from './knowledge-base.interface.js';
import { IEmbeddingProvider } from '../embeddings/embedding-provider.interface.js';
import { RecursiveCharacterTextSplitter } from './text-splitter.js';
import { IEventBus } from '../../../events/event-bus.interface.js';
import { createKnowledgeIngestedEvent } from '../ai.events.js';
import { logger } from '../../../common/logger/logger.service.js';
import { envConfig } from '../../../config/env.config.js';

const MOCK_MODEL = 'mock:hash-v1';

/**
 * Lowest similarity a chunk needs to be used in an answer. Real embedding models score
 * unrelated text around 0.1-0.25, so 0.35 keeps answers to relevant excerpts; the hash-based
 * mock scores lower overall and gets its own floor. RAG_MIN_SIMILARITY overrides both.
 */
function defaultMinSimilarity(modelId: string): number {
  const configured = Number(process.env.RAG_MIN_SIMILARITY);
  if (Number.isFinite(configured) && configured > 0 && configured < 1) return configured;
  return modelId === MOCK_MODEL ? 0.18 : 0.35;
}

export class KnowledgeBaseService {
  private readonly textSplitter: RecursiveCharacterTextSplitter;

  public constructor(
    private readonly repository: IKnowledgeBaseRepository,
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly eventBus: IEventBus,
    textSplitter?: RecursiveCharacterTextSplitter,
  ) {
    this.textSplitter =
      textSplitter ||
      new RecursiveCharacterTextSplitter({
        chunkSize: 1500, // ~375 tokens
        chunkOverlap: 300, // ~75 tokens
      });
  }

  /**
   * Whether this server can make meaningful embeddings. In production the hash-based mock is
   * never used: its vectors would have to be replaced once a real model is configured, and its
   * search results are too rough to answer parents from.
   */
  public get canEmbed(): boolean {
    return (
      this.embeddingProvider.modelId !== MOCK_MODEL || envConfig.get('NODE_ENV') !== 'production'
    );
  }

  /**
   * Ingests a raw document, policy, syllabus, or FAQ into the coaching's Knowledge Base.
   * Chunks the document, generates 1536-dimensional vector embeddings, and stores them in pgvector.
   */
  public async ingestDocument(
    dto: CreateKnowledgeBaseDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<{ document: KnowledgeBaseEntity; chunksCount: number }> {
    if (!dto.title || dto.title.trim().length === 0) {
      throw new Error('Document title cannot be empty');
    }
    if (!dto.rawContent || dto.rawContent.trim().length === 0) {
      throw new Error('Document content cannot be empty');
    }

    logger.info(`[KnowledgeBaseService] Ingesting document "${dto.title}" for coaching: ${coachingId}`);

    // 1. Create document record (kept even when it cannot be embedded yet; see reindexPending)
    const document = await this.repository.createDocument(dto, coachingId);
    if (!this.canEmbed) {
      logger.warn(
        `[KnowledgeBaseService] No embedding model configured; "${dto.title}" is saved and will be indexed by kb:reindex`,
      );
      return { document, chunksCount: 0 };
    }

    // 2-4. Chunk, embed and store
    const chunksCount = await this.embedAndStore(document);
    if (chunksCount === 0) {
      return { document, chunksCount: 0 };
    }

    // 5. Emit Domain Event
    await this.eventBus.publish(
      createKnowledgeIngestedEvent(
        {
          coachingId,
          documentId: document.id,
          title: document.title,
          type: document.type,
          totalChunks: chunksCount,
        },
        correlationId,
        userId,
      ),
    );

    logger.info(
      `[KnowledgeBaseService] Successfully ingested document "${dto.title}" (${chunksCount} chunks)`,
    );

    return { document, chunksCount };
  }

  /**
   * Performs hybrid vector search across the coaching institute's knowledge chunks.
   * Strictly isolates lookups by coachingId.
   */
  public async searchKnowledge(
    query: string,
    coachingId: string,
    limit: number = 4,
    threshold: number = defaultMinSimilarity(this.embeddingProvider.modelId),
  ): Promise<KnowledgeChunkEntity[]> {
    if (!query || query.trim().length === 0 || !this.canEmbed) {
      return [];
    }

    // 1. Generate query embedding vector
    const queryVector = await this.embeddingProvider.generateEmbedding(query.trim());

    // 2. Query repository via HNSW cosine distance
    return this.repository.searchSimilarChunks({
      queryVector,
      embeddingModel: this.embeddingProvider.modelId,
      coachingId,
      limit,
      threshold,
      textQuery: query.trim(),
    });
  }

  /**
   * Embeds documents that have no chunks from the current model: those added before a model was
   * configured, or embedded by a different one. Run after setting or changing embedding keys
   * (pnpm --filter @vargly/api kb:reindex). Returns how many documents were indexed.
   */
  public async reindexPending(batchSize = 50): Promise<number> {
    if (!this.canEmbed) {
      throw new Error('No embedding model is configured (set OPENAI_API_KEY or GEMINI_API_KEY)');
    }
    let indexed = 0;
    for (;;) {
      const documents = await this.repository.findDocumentsNeedingEmbedding(
        this.embeddingProvider.modelId,
        batchSize,
      );
      if (documents.length === 0) return indexed;
      for (const document of documents) {
        await this.repository.deactivateChunks(document.id);
        const chunks = await this.embedAndStore(document);
        indexed += 1;
        logger.info(`[KnowledgeBaseService] Re-indexed "${document.title}" (${chunks} chunks)`);
      }
    }
  }

  /** Splits a document, embeds each chunk with the current model and stores them */
  private async embedAndStore(document: KnowledgeBaseEntity): Promise<number> {
    const textChunks = this.textSplitter.splitText(document.rawContent);
    if (textChunks.length === 0) return 0;

    const vectors = await this.embeddingProvider.generateEmbeddings(
      textChunks.map((c) => c.content),
    );
    await this.repository.insertChunks(
      textChunks.map((c, i) => ({
        coachingId: document.coachingId,
        knowledgeBaseId: document.id,
        chunkIndex: c.chunkIndex,
        content: c.content,
        tokenCount: c.estimatedTokens,
        metadata: {
          documentTitle: document.title,
          documentType: document.type || 'FAQ',
          characterCount: c.characterCount,
        },
        vector: vectors[i]!,
        embeddingModel: this.embeddingProvider.modelId,
      })),
    );
    return textChunks.length;
  }

  public async listDocuments(
    coachingId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<KnowledgeBaseEntity[]> {
    return this.repository.listByCoaching(coachingId, limit, offset);
  }

  public async getDocument(id: string, coachingId: string): Promise<KnowledgeBaseEntity | null> {
    return this.repository.findById(id, coachingId);
  }

  public async deleteDocument(id: string, coachingId: string): Promise<boolean> {
    return this.repository.deleteDocument(id, coachingId);
  }
}
