import { StatusCodes } from 'http-status-codes';
import { INoticeRepository } from './notice.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import {
  CreateNoticeDto,
  NoticeFilterDto,
  NoticeResponseDto,
  UpdateNoticeDto,
} from './dto/notice.dto.js';
import { NoticeMapper } from './notice.mapper.js';
import {
  createNoticeCreatedEvent,
  createNoticeDeletedEvent,
  createNoticeUpdatedEvent,
} from './notice.events.js';

export class NoticeService {
  public constructor(
    private readonly noticeRepository: INoticeRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async createNotice(
    dto: CreateNoticeDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<NoticeResponseDto> {
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    const notice = await this.noticeRepository.create({
      coachingId,
      title: dto.title,
      content: dto.content,
      batchId: dto.batchId,
      targetAudience: dto.targetAudience,
      isPinned: dto.isPinned,
      expiresAt,
      createdBy: userId,
    });

    const responseDto = NoticeMapper.toResponseDto(notice);

    await this.eventBus.publish(
      createNoticeCreatedEvent(
        {
          noticeId: responseDto.id,
          coachingId,
          batchId: responseDto.batchId,
          title: responseDto.title,
          content: responseDto.content,
          targetAudience: responseDto.targetAudience,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async updateNotice(
    id: string,
    dto: UpdateNoticeDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<NoticeResponseDto> {
    const existing = await this.noticeRepository.findById(id);
    if (!existing || existing.coachingId !== coachingId) {
      throw new AppError('NOTICE_NOT_FOUND', 'Notice not found', StatusCodes.NOT_FOUND);
    }

    const expiresAt =
      dto.expiresAt !== undefined
        ? dto.expiresAt
          ? new Date(dto.expiresAt)
          : null
        : undefined;

    const updated = await this.noticeRepository.update(id, {
      title: dto.title,
      content: dto.content,
      batchId: dto.batchId,
      targetAudience: dto.targetAudience,
      isPinned: dto.isPinned,
      expiresAt,
    });

    const responseDto = NoticeMapper.toResponseDto(updated);

    await this.eventBus.publish(
      createNoticeUpdatedEvent(
        {
          noticeId: responseDto.id,
          coachingId,
          title: responseDto.title,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async deleteNotice(
    id: string,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<void> {
    const existing = await this.noticeRepository.findById(id);
    if (!existing || existing.coachingId !== coachingId) {
      throw new AppError('NOTICE_NOT_FOUND', 'Notice not found', StatusCodes.NOT_FOUND);
    }

    await this.noticeRepository.softDelete(id);

    await this.eventBus.publish(
      createNoticeDeletedEvent(
        {
          noticeId: id,
          coachingId,
        },
        correlationId,
        userId,
      ),
    );
  }

  public async getNoticeById(id: string, coachingId: string): Promise<NoticeResponseDto> {
    const notice = await this.noticeRepository.findById(id);
    if (!notice || notice.coachingId !== coachingId) {
      throw new AppError('NOTICE_NOT_FOUND', 'Notice not found', StatusCodes.NOT_FOUND);
    }
    return NoticeMapper.toResponseDto(notice);
  }

  public async listNotices(
    coachingId: string,
    filter?: NoticeFilterDto,
  ): Promise<NoticeResponseDto[]> {
    const list = await this.noticeRepository.findMany(coachingId, filter);
    return list.map(NoticeMapper.toResponseDto);
  }
}
