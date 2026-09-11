import { IAuditRepository } from './audit.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AuditLogFilterDto, AuditLogResponseDto, RecordAuditLogDto } from './dto/audit.dto.js';
import { AuditMapper } from './audit.mapper.js';
import { createAuditLogCreatedEvent } from './audit.events.js';

export class AuditService {
  public constructor(
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async recordLog(
    dto: RecordAuditLogDto,
    coachingId: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<AuditLogResponseDto> {
    const log = await this.auditRepository.create({
      coachingId,
      userId: dto.userId,
      action: dto.action,
      entityName: dto.entityName,
      entityId: dto.entityId,
      beforeState: dto.beforeState,
      afterState: dto.afterState,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
    });

    const responseDto = AuditMapper.toResponseDto(log);

    await this.eventBus.publish(
      createAuditLogCreatedEvent(
        {
          logId: responseDto.id,
          coachingId,
          action: responseDto.action,
          entityName: responseDto.entityName,
          entityId: responseDto.entityId,
        },
        correlationId,
        dto.userId,
      ),
    );

    return responseDto;
  }

  public async getAuditLogs(
    coachingId: string,
    filter?: AuditLogFilterDto,
  ): Promise<AuditLogResponseDto[]> {
    const list = await this.auditRepository.findMany(coachingId, {
      entityName: filter?.entityName,
      action: filter?.action,
      userId: filter?.userId,
      limit: filter?.limit,
      offset: filter?.offset,
    });
    return list.map(AuditMapper.toResponseDto);
  }
}
