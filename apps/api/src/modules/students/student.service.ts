import { StatusCodes } from 'http-status-codes';
import { IStudentRepository } from './student.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { CreateStudentDto, StudentResponseDto, UpdateStudentDto } from './dto/student.dto.js';
import { StudentMapper } from './student.mapper.js';
import { createStudentCreatedEvent, createStudentUpdatedEvent } from './student.events.js';

export class StudentService {
  public constructor(
    private readonly studentRepository: IStudentRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async enrollStudent(
    dto: CreateStudentDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<StudentResponseDto> {
    const data: any = {
      coachingId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      rollNumber: dto.rollNumber,
      gender: dto.gender,
      dob: dto.dob ? new Date(dto.dob) : undefined,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
      joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
    };

    const created = await this.studentRepository.create(data);
    const responseDto = StudentMapper.toResponseDto(created);

    // Emit domain event
    await this.eventBus.publish(
      createStudentCreatedEvent(
        {
          studentId: responseDto.id,
          coachingId: responseDto.coachingId,
          firstName: responseDto.firstName,
          lastName: responseDto.lastName,
          phone: responseDto.phone,
          email: responseDto.email,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async getStudentById(id: string): Promise<StudentResponseDto> {
    const student = await this.studentRepository.findById(id);
    if (!student) {
      throw new AppError('STUDENT_NOT_FOUND', 'Student record not found', StatusCodes.NOT_FOUND);
    }
    return StudentMapper.toResponseDto(student);
  }

  public async listStudents(filters?: { isActive?: boolean; search?: string }): Promise<StudentResponseDto[]> {
    const students = await this.studentRepository.findMany(filters);
    return students.map(StudentMapper.toResponseDto);
  }

  public async updateStudent(
    id: string,
    dto: UpdateStudentDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<StudentResponseDto> {
    const existing = await this.studentRepository.findById(id);
    if (!existing) {
      throw new AppError('STUDENT_NOT_FOUND', 'Student record not found', StatusCodes.NOT_FOUND);
    }

    const updateData: any = { ...dto };
    if (dto.dob) updateData.dob = new Date(dto.dob);

    const updated = await this.studentRepository.update(id, updateData);
    const responseDto = StudentMapper.toResponseDto(updated);

    await this.eventBus.publish(
      createStudentUpdatedEvent(
        {
          studentId: responseDto.id,
          coachingId,
          changes: dto as Record<string, unknown>,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async deleteStudent(id: string): Promise<void> {
    const existing = await this.studentRepository.findById(id);
    if (!existing) {
      throw new AppError('STUDENT_NOT_FOUND', 'Student record not found', StatusCodes.NOT_FOUND);
    }
    await this.studentRepository.softDelete(id);
  }
}
