import { ITimelineRepository } from './timeline.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import {
  RecordTimelineEntryDto,
  TimelineFilterDto,
  TimelineResponseDto,
} from './dto/timeline.dto.js';
import { TimelineMapper } from './timeline.mapper.js';
import { createTimelineEntryRecordedEvent } from './timeline.events.js';

export class TimelineService {
  public constructor(
    private readonly timelineRepository: ITimelineRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async recordEntry(
    dto: RecordTimelineEntryDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<TimelineResponseDto> {
    const entry = await this.timelineRepository.create({
      coachingId,
      studentId: dto.studentId,
      eventType: dto.eventType,
      summary: dto.summary,
      referenceId: dto.referenceId,
      metadata: dto.metadata,
      occurredAt: dto.occurredAt || new Date(),
    });

    const responseDto = TimelineMapper.toResponseDto(entry);

    await this.eventBus.publish(
      createTimelineEntryRecordedEvent(
        {
          entryId: responseDto.id,
          coachingId,
          studentId: responseDto.studentId,
          eventType: responseDto.eventType,
          summary: responseDto.summary,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async getStudentTimeline(
    studentId: string,
    filter?: TimelineFilterDto,
  ): Promise<TimelineResponseDto[]> {
    const list = await this.timelineRepository.findByStudent(studentId, {
      limit: filter?.limit,
      offset: filter?.offset,
      eventType: filter?.eventType,
    });
    return list.map(TimelineMapper.toResponseDto);
  }
}
