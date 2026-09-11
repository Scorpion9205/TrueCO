import { AuditLogResponseDto } from './dto/audit.dto.js';

export class AuditMapper {
  public static toResponseDto(entity: any): AuditLogResponseDto {
    return {
      id: entity.id,
      coachingId: entity.coachingId,
      userId: entity.userId,
      action: entity.action,
      entityName: entity.entityName,
      entityId: entity.entityId,
      beforeState: entity.beforeState ? (entity.beforeState as Record<string, unknown>) : null,
      afterState: entity.afterState ? (entity.afterState as Record<string, unknown>) : null,
      ipAddress: entity.ipAddress,
      userAgent: entity.userAgent,
      createdAt: new Date(entity.createdAt),
    };
  }
}
