import { IDashboardRepository } from './dashboard.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import {
  OwnerDashboardResponseDto,
  TeacherDashboardResponseDto,
} from './dto/dashboard.dto.js';
import { DashboardMapper } from './dashboard.mapper.js';
import { createDashboardViewedEvent } from './dashboard.events.js';

export class DashboardService {
  public constructor(
    private readonly dashboardRepository: IDashboardRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async getOwnerOverview(
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<OwnerDashboardResponseDto> {
    const rawData = await this.dashboardRepository.getOwnerDashboardData(coachingId);
    const responseDto = DashboardMapper.toOwnerResponseDto(rawData);

    await this.eventBus.publish(
      createDashboardViewedEvent(
        {
          coachingId,
          portal: 'OWNER',
          viewedBy: userId,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async getTeacherOverview(
    coachingId: string,
    teacherId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<TeacherDashboardResponseDto> {
    const rawData = await this.dashboardRepository.getTeacherDashboardData(coachingId, teacherId);
    const responseDto = DashboardMapper.toTeacherResponseDto(rawData);

    await this.eventBus.publish(
      createDashboardViewedEvent(
        {
          coachingId,
          portal: 'TEACHER',
          viewedBy: userId,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }
}
