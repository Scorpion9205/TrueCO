import { StatusCodes } from 'http-status-codes';
import { IBatchRepository } from './batch.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { AssignTeacherToBatchDto, BatchResponseDto, CreateBatchDto, EnrollStudentInBatchDto } from './dto/batch.dto.js';
import { BatchMapper } from './batch.mapper.js';
import { createBatchCreatedEvent, createStudentEnrolledInBatchEvent } from './batch.events.js';

export class BatchService {
  public constructor(
    private readonly batchRepository: IBatchRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async createBatch(
    dto: CreateBatchDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<BatchResponseDto> {
    const batchData: any = {
      coachingId,
      name: dto.name,
      subject: dto.subject,
      academicYear: dto.academicYear,
      startTime: dto.startTime,
      endTime: dto.endTime,
      daysOfWeek: dto.daysOfWeek || [],
    };

    const created = await this.batchRepository.create(batchData, dto.teacherIds);
    const responseDto = BatchMapper.toResponseDto(created);

    await this.eventBus.publish(
      createBatchCreatedEvent(
        {
          batchId: responseDto.id,
          coachingId,
          name: responseDto.name,
          academicYear: responseDto.academicYear,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async enrollStudent(
    batchId: string,
    dto: EnrollStudentInBatchDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<void> {
    const batch = await this.batchRepository.findById(batchId);
    if (!batch) {
      throw new AppError('BATCH_NOT_FOUND', 'Batch record not found', StatusCodes.NOT_FOUND);
    }

    const enrollment = await this.batchRepository.enrollStudent({
      batchId,
      studentId: dto.studentId,
      coachingId,
    });

    await this.eventBus.publish(
      createStudentEnrolledInBatchEvent(
        {
          coachingId,
          batchId,
          studentId: dto.studentId,
          joinedAt: enrollment.joinedAt || new Date(),
        },
        correlationId,
        userId,
      ),
    );
  }

  public async withdrawStudent(batchId: string, studentId: string): Promise<void> {
    await this.batchRepository.withdrawStudent(batchId, studentId);
  }

  public async assignTeacher(
    batchId: string,
    dto: AssignTeacherToBatchDto,
    coachingId: string,
  ): Promise<void> {
    const batch = await this.batchRepository.findById(batchId);
    if (!batch) {
      throw new AppError('BATCH_NOT_FOUND', 'Batch record not found', StatusCodes.NOT_FOUND);
    }

    await this.batchRepository.assignTeacher({
      batchId,
      teacherId: dto.teacherId,
      coachingId,
      isPrimary: dto.isPrimary ?? true,
    });
  }

  public async getBatchById(id: string): Promise<BatchResponseDto> {
    const batch = await this.batchRepository.findById(id);
    if (!batch) {
      throw new AppError('BATCH_NOT_FOUND', 'Batch record not found', StatusCodes.NOT_FOUND);
    }
    return BatchMapper.toResponseDto(batch);
  }

  public async listBatches(filters?: { isActive?: boolean; academicYear?: string; teacherId?: string }): Promise<BatchResponseDto[]> {
    const batches = await this.batchRepository.findMany(filters);
    return batches.map(BatchMapper.toResponseDto);
  }

  public async getActiveStudentsInBatch(batchId: string): Promise<any[]> {
    return this.batchRepository.findActiveStudents(batchId);
  }
}
