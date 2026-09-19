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

    // 1. Create document record
    const document = await this.repository.createDocument(dto, coachingId);

    // 2. Chunk text recursively
    const textChunks = this.textSplitter.splitText(dto.rawContent);
    if (textChunks.length === 0) {
      return { document, chunksCount: 0 };
    }

    // 3. Generate embeddings in parallel
    const chunkContents = textChunks.map((c) => c.content);
    const vectors = await this.embeddingProvider.generateEmbeddings(chunkContents);

    // 4. Store vector chunks in pgvector table
    const recordsToInsert = textChunks.map((c, i) => ({
      coachingId,
      knowledgeBaseId: document.id,
      chunkIndex: c.chunkIndex,
      content: c.content,
      tokenCount: c.estimatedTokens,
      metadata: {
        documentTitle: dto.title,
        documentType: dto.type || 'FAQ',
        characterCount: c.characterCount,
      },
      vector: vectors[i],
    }));

    await this.repository.insertChunks(recordsToInsert);

    // 5. Emit Domain Event
    await this.eventBus.publish(
      createKnowledgeIngestedEvent(
        {
          coachingId,
          documentId: document.id,
          title: document.title,
          type: document.type,
          totalChunks: textChunks.length,
        },
        correlationId,
        userId,
      ),
    );

    logger.info(
      `[KnowledgeBaseService] Successfully ingested document "${dto.title}" (${textChunks.length} chunks)`,
    );

    return { document, chunksCount: textChunks.length };
  }

  /**
   * Performs hybrid vector search across the coaching institute's knowledge chunks.
   * Strictly isolates lookups by coachingId.
   */
  public async searchKnowledge(
    query: string,
    coachingId: string,
    limit: number = 4,
    threshold: number = 0.6,
  ): Promise<KnowledgeChunkEntity[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    // 1. Generate query embedding vector
    const queryVector = await this.embeddingProvider.generateEmbedding(query.trim());

    // 2. Query repository via HNSW cosine distance
    return this.repository.searchSimilarChunks({
      queryVector,
      coachingId,
      limit,
      threshold,
      textQuery: query.trim(),
    });
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
