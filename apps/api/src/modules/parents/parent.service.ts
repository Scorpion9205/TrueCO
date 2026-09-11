import { StatusCodes } from 'http-status-codes';
import { IParentRepository } from './parent.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { CreateParentDto, LinkStudentParentDto, ParentResponseDto } from './dto/parent.dto.js';
import { ParentMapper } from './parent.mapper.js';
import { createParentCreatedEvent, createStudentParentLinkedEvent } from './parent.events.js';

export class ParentService {
  public constructor(
    private readonly parentRepository: IParentRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async createParent(
    dto: CreateParentDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<ParentResponseDto> {
    const existing = await this.parentRepository.findByPhone(dto.phone);
    let parent = existing;

    if (!parent) {
      parent = await this.parentRepository.create({
        coachingId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        relation: dto.relation || 'FATHER',
      });

      await this.eventBus.publish(
        createParentCreatedEvent(
          {
            parentId: parent.id,
            coachingId,
            name: parent.name,
            phone: parent.phone,
          },
          correlationId,
          userId,
        ),
      );
    }

    if (dto.studentId) {
      await this.parentRepository.linkStudent({
        studentId: dto.studentId,
        parentId: parent.id,
        coachingId,
        isPrimary: dto.isPrimary ?? true,
      });

      await this.eventBus.publish(
        createStudentParentLinkedEvent(
          {
            coachingId,
            studentId: dto.studentId,
            parentId: parent.id,
            isPrimary: dto.isPrimary ?? true,
          },
          correlationId,
          userId,
        ),
      );
    }

    const refreshed = await this.parentRepository.findById(parent.id);
    return ParentMapper.toResponseDto(refreshed);
  }

  public async linkStudent(
    dto: LinkStudentParentDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<void> {
    await this.parentRepository.linkStudent({
      studentId: dto.studentId,
      parentId: dto.parentId,
      coachingId,
      isPrimary: dto.isPrimary ?? true,
    });

    await this.eventBus.publish(
      createStudentParentLinkedEvent(
        {
          coachingId,
          studentId: dto.studentId,
          parentId: dto.parentId,
          isPrimary: dto.isPrimary ?? true,
        },
        correlationId,
        userId,
      ),
    );
  }

  public async getParentById(id: string): Promise<ParentResponseDto> {
    const parent = await this.parentRepository.findById(id);
    if (!parent) {
      throw new AppError('PARENT_NOT_FOUND', 'Parent record not found', StatusCodes.NOT_FOUND);
    }
    return ParentMapper.toResponseDto(parent);
  }

  public async getParentByPhone(phone: string): Promise<ParentResponseDto | null> {
    const parent = await this.parentRepository.findByPhone(phone);
    return parent ? ParentMapper.toResponseDto(parent) : null;
  }

  public async listParents(search?: string): Promise<ParentResponseDto[]> {
    const parents = await this.parentRepository.findMany(search);
    return parents.map(ParentMapper.toResponseDto);
  }
}
