import { StatusCodes } from 'http-status-codes';
import { IAttendanceRepository } from './attendance.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { AttendanceSessionResponseDto, MarkAttendanceDto } from './dto/attendance.dto.js';
import { AttendanceMapper } from './attendance.mapper.js';
import { createAttendanceMarkedEvent } from './attendance.events.js';

export class AttendanceService {
  public constructor(
    private readonly attendanceRepository: IAttendanceRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async markAttendance(
    dto: MarkAttendanceDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<AttendanceSessionResponseDto> {
    const sessionDate = new Date(dto.sessionDate);

    const session = await this.attendanceRepository.upsertSessionWithRecords({
      coachingId,
      batchId: dto.batchId,
      sessionDate,
      slot: dto.slot,
      markedById: userId,
      remarks: dto.remarks,
      records: dto.records,
    });

    const responseDto = AttendanceMapper.toSessionResponseDto(session);

    // Emit domain event — side effects (WhatsApp/SMS, Timeline, Audit) handled by subscribers
    await this.eventBus.publish(
      createAttendanceMarkedEvent(
        {
          sessionId: responseDto.id,
          coachingId,
          batchId: dto.batchId,
          sessionDate,
          markedBy: userId,
          records: dto.records.map((r) => ({
            studentId: r.studentId,
            status: r.status,
            remarks: r.remarks,
          })),
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async getSessionById(id: string): Promise<AttendanceSessionResponseDto> {
    const session = await this.attendanceRepository.findSessionById(id);
    if (!session) {
      throw new AppError('SESSION_NOT_FOUND', 'Attendance session not found', StatusCodes.NOT_FOUND);
    }
    return AttendanceMapper.toSessionResponseDto(session);
  }

  public async getBatchAttendanceHistory(
    batchId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<AttendanceSessionResponseDto[]> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const sessions = await this.attendanceRepository.findSessionsByBatch(batchId, start, end);
    return sessions.map(AttendanceMapper.toSessionResponseDto);
  }
}
