import { IAccessCacheInvalidator } from '../../common/security/permission-resolver.service.js';
import { StatusCodes } from 'http-status-codes';
import { ITeacherRepository } from './teacher.repository.js';
import { IPasswordService } from '../../common/security/password.service.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { CreateTeacherDto, TeacherResponseDto, UpdateTeacherDto } from './dto/teacher.dto.js';
import { TeacherMapper } from './teacher.mapper.js';
import { createTeacherCreatedEvent } from './teacher.events.js';

export class TeacherService {
  public constructor(
    private readonly teacherRepository: ITeacherRepository,
    private readonly passwordService: IPasswordService,
    private readonly eventBus: IEventBus,
    private readonly accessInvalidator?: IAccessCacheInvalidator,
  ) {}

  public async createTeacher(
    dto: CreateTeacherDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<TeacherResponseDto> {
    const rawPassword = dto.password || dto.phone; // Fallback temporary password
    const passwordHash = await this.passwordService.hash(rawPassword);

    const teacher = await this.teacherRepository.createWithUser({
      coachingId,
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      passwordHash,
      specialization: dto.specialization,
      monthlySalary: dto.monthlySalary,
      joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
    });

    const responseDto = TeacherMapper.toResponseDto(teacher);

    await this.eventBus.publish(
      createTeacherCreatedEvent(
        {
          teacherId: responseDto.id,
          coachingId,
          userId: responseDto.userId,
          name: responseDto.name,
          email: responseDto.email,
          phone: responseDto.phone,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async getTeacherById(id: string): Promise<TeacherResponseDto> {
    const teacher = await this.teacherRepository.findById(id);
    if (!teacher) {
      throw new AppError('TEACHER_NOT_FOUND', 'Teacher profile not found', StatusCodes.NOT_FOUND);
    }
    return TeacherMapper.toResponseDto(teacher);
  }

  public async getTeacherByUserId(userId: string): Promise<TeacherResponseDto> {
    const teacher = await this.teacherRepository.findByUserId(userId);
    if (!teacher) {
      throw new AppError('TEACHER_NOT_FOUND', 'Teacher profile not found for user', StatusCodes.NOT_FOUND);
    }
    return TeacherMapper.toResponseDto(teacher);
  }

  public async listTeachers(filters?: { isActive?: boolean; search?: string }): Promise<TeacherResponseDto[]> {
    const teachers = await this.teacherRepository.findMany(filters);
    return teachers.map(TeacherMapper.toResponseDto);
  }

  public async updateTeacher(id: string, dto: UpdateTeacherDto): Promise<TeacherResponseDto> {
    const existing = await this.teacherRepository.findById(id);
    if (!existing) {
      throw new AppError('TEACHER_NOT_FOUND', 'Teacher profile not found', StatusCodes.NOT_FOUND);
    }

    const updated = await this.teacherRepository.update(id, dto);
    // Activation status gates the teaching role; apply it on the teacher's next request
    if (dto.isActive !== undefined && existing.userId) {
      await this.accessInvalidator?.invalidate(existing.userId);
    }
    return TeacherMapper.toResponseDto(updated);
  }
}
