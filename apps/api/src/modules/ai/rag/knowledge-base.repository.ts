import { getPrismaClient, ExtendedPrismaClient } from '../../../database/prisma/tenant-prisma.extension.js';
import {
  IKnowledgeBaseRepository,
  KnowledgeBaseEntity,
  KnowledgeChunkEntity,
  CreateKnowledgeBaseDto,
  SearchKnowledgeQuery,
} from './knowledge-base.interface.js';

export class PrismaKnowledgeBaseRepository implements IKnowledgeBaseRepository {
  private readonly prisma: ExtendedPrismaClient;

  public constructor(prisma?: ExtendedPrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  public async createDocument(
    data: CreateKnowledgeBaseDto,
    coachingId: string,
  ): Promise<KnowledgeBaseEntity> {
    const raw = await (this.prisma as any).coachingKnowledgeBase.create({
      data: {
        coachingId,
        title: data.title,
        type: data.type || 'FAQ',
        description: data.description || null,
        sourceUrl: data.sourceUrl || null,
        rawContent: data.rawContent,
        characterCount: data.rawContent.length,
        isActive: true,
      },
    });

    return this.toEntity(raw);
  }

  public async findById(id: string, coachingId: string): Promise<KnowledgeBaseEntity | null> {
    const raw = await (this.prisma as any).coachingKnowledgeBase.findFirst({
      where: {
        id,
        coachingId,
        deletedAt: null,
      },
    });

    return raw ? this.toEntity(raw) : null;
  }

  public async listByCoaching(
    coachingId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<KnowledgeBaseEntity[]> {
    const rawList = await (this.prisma as any).coachingKnowledgeBase.findMany({
      where: {
        coachingId,
        deletedAt: null,
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    return rawList.map((r: any) => this.toEntity(r));
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
    for (const chunk of chunks) {
      const vectorStr = `[${chunk.vector.join(',')}]`;
      const metadataStr = JSON.stringify(chunk.metadata || {});

      await this.prisma.$executeRaw`
        INSERT INTO coaching_knowledge_chunks (
          id, coaching_id, knowledge_base_id, chunk_index, content, token_count, metadata, embedding, is_active, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${chunk.coachingId}::uuid,
          ${chunk.knowledgeBaseId}::uuid,
          ${chunk.chunkIndex},
          ${chunk.content},
          ${chunk.tokenCount},
          ${metadataStr}::jsonb,
          ${vectorStr}::vector,
          true,
          NOW(),
          NOW()
        );
      `;
    }
  }

  public async searchSimilarChunks(options: SearchKnowledgeQuery): Promise<KnowledgeChunkEntity[]> {
    const vectorStr = `[${options.queryVector.join(',')}]`;
    const limit = options.limit ?? 4;
    const threshold = options.threshold ?? 0.6;
    const maxDistance = 1.0 - threshold;

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT 
        id,
        coaching_id as "coachingId",
        knowledge_base_id as "knowledgeBaseId",
        chunk_index as "chunkIndex",
        content,
        token_count as "tokenCount",
        metadata,
        (1 - (embedding <=> ${vectorStr}::vector)) as similarity
      FROM coaching_knowledge_chunks
      WHERE coaching_id = ${options.coachingId}::uuid
        AND is_active = true
        AND (embedding <=> ${vectorStr}::vector) <= ${maxDistance}
      ORDER BY embedding <=> ${vectorStr}::vector ASC
      LIMIT ${limit};
    `;

    return rows.map((r) => ({
      id: r.id,
      coachingId: r.coachingId,
      knowledgeBaseId: r.knowledgeBaseId,
      chunkIndex: r.chunkIndex,
      content: r.content,
      tokenCount: r.tokenCount,
      metadata: r.metadata,
      similarity: Number(Number(r.similarity).toFixed(4)),
    }));
  }

  public async deleteDocument(id: string, coachingId: string): Promise<boolean> {
    const doc = await this.findById(id, coachingId);
    if (!doc) return false;

    // Soft delete document and deactivate its chunks
    await (this.prisma as any).coachingKnowledgeBase.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.prisma.$executeRaw`
      UPDATE coaching_knowledge_chunks
      SET is_active = false, updated_at = NOW()
      WHERE knowledge_base_id = ${id}::uuid AND coaching_id = ${coachingId}::uuid;
    `;

    return true;
  }

  private toEntity(raw: any): KnowledgeBaseEntity {
    return {
      id: raw.id,
      coachingId: raw.coachingId,
      title: raw.title,
      type: raw.type,
      description: raw.description,
      sourceUrl: raw.sourceUrl,
      rawContent: raw.rawContent,
      characterCount: raw.characterCount,
      isActive: raw.isActive,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
