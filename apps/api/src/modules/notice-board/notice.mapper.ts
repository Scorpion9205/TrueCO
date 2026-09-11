import { NoticeResponseDto } from './dto/notice.dto.js';

export class NoticeMapper {
  public static toResponseDto(entity: any): NoticeResponseDto {
    return {
      id: entity.id,
      coachingId: entity.coachingId,
      batchId: entity.batchId,
      batchName: entity.batch?.name,
      title: entity.title,
      content: entity.content,
      targetAudience: entity.targetAudience,
      isPinned: entity.isPinned,
      expiresAt: entity.expiresAt ? new Date(entity.expiresAt) : null,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
    };
  }
}
