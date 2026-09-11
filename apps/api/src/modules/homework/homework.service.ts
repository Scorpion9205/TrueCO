import { StatusCodes } from 'http-status-codes';
import { IHomeworkRepository } from './homework.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import {
  CreateHomeworkDto,
  HomeworkResponseDto,
  UpdateHomeworkDto,
} from './dto/homework.dto.js';
import { HomeworkMapper } from './homework.mapper.js';
import {
  createHomeworkCreatedEvent,
  createHomeworkUpdatedEvent,
} from './homework.events.js';

export class HomeworkService {
  public constructor(
    private readonly homeworkRepository: IHomeworkRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async createHomework(
    dto: CreateHomeworkDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<HomeworkResponseDto> {
    const dueDate = new Date(dto.dueDate);

    const homework = await this.homeworkRepository.create({
      coachingId,
      batchId: dto.batchId,
      title: dto.title,
      description: dto.description,
      dueDate,
      attachmentUrl: dto.attachmentUrl,
      createdBy: userId,
    });

    const responseDto = HomeworkMapper.toResponseDto(homework);

    await this.eventBus.publish(
      createHomeworkCreatedEvent(
        {
          homeworkId: responseDto.id,
          coachingId,
          batchId: dto.batchId,
          title: dto.title,
          dueDate,
          attachmentUrl: dto.attachmentUrl,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async updateHomework(
    id: string,
    dto: UpdateHomeworkDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<HomeworkResponseDto> {
    const existing = await this.homeworkRepository.findById(id);
    if (!existing) {
      throw new AppError('HOMEWORK_NOT_FOUND', 'Homework assignment not found', StatusCodes.NOT_FOUND);
    }

    const dueDate = dto.dueDate ? new Date(dto.dueDate) : undefined;

    const updated = await this.homeworkRepository.update(id, {
      title: dto.title,
      description: dto.description,
      dueDate,
      attachmentUrl: dto.attachmentUrl,
      updatedBy: userId,
    });

    const responseDto = HomeworkMapper.toResponseDto(updated);

    await this.eventBus.publish(
      createHomeworkUpdatedEvent(
        {
          homeworkId: responseDto.id,
          coachingId,
          batchId: responseDto.batchId,
          title: responseDto.title,
          dueDate: responseDto.dueDate,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async getHomeworkById(id: string): Promise<HomeworkResponseDto> {
    const homework = await this.homeworkRepository.findById(id);
    if (!homework) {
      throw new AppError('HOMEWORK_NOT_FOUND', 'Homework assignment not found', StatusCodes.NOT_FOUND);
    }
    return HomeworkMapper.toResponseDto(homework);
  }

  public async getHomeworkByBatch(batchId: string): Promise<HomeworkResponseDto[]> {
    const list = await this.homeworkRepository.findByBatch(batchId);
    return list.map((h) => HomeworkMapper.toResponseDto(h));
  }

  public async deleteHomework(id: string, userId?: string): Promise<void> {
    const existing = await this.homeworkRepository.findById(id);
    if (!existing) {
      throw new AppError('HOMEWORK_NOT_FOUND', 'Homework assignment not found', StatusCodes.NOT_FOUND);
    }
    await this.homeworkRepository.softDelete(id, userId);
  }
}
