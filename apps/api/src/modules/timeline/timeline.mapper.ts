import { TimelineResponseDto } from './dto/timeline.dto.js';

export class TimelineMapper {
  public static toResponseDto(entity: any): TimelineResponseDto {
    return {
      id: entity.id,
      coachingId: entity.coachingId,
      studentId: entity.studentId,
      eventType: entity.eventType,
      summary: entity.summary,
      referenceId: entity.referenceId,
      metadata: entity.metadata ? (entity.metadata as Record<string, unknown>) : null,
      occurredAt: new Date(entity.occurredAt),
      createdAt: new Date(entity.createdAt),
    };
  }
}
