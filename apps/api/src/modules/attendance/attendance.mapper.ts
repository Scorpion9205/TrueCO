import { AttendanceSessionResponseDto } from './dto/attendance.dto.js';
import { AttendanceStatus } from '@vargly/types';

export class AttendanceMapper {
  public static toSessionResponseDto(entity: any): AttendanceSessionResponseDto {
    const records = (entity.records || []).map((r: any) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: r.student ? `${r.student.firstName} ${r.student.lastName}` : 'Unknown',
      status: r.status as AttendanceStatus,
      remarks: r.remarks,
    }));

    const presentCount = records.filter(
      (r: any) => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE,
    ).length;

    const absentCount = records.filter((r: any) => r.status === AttendanceStatus.ABSENT).length;

    return {
      id: entity.id,
      coachingId: entity.coachingId,
      batchId: entity.batchId,
      sessionDate: new Date(entity.sessionDate),
      slot: entity.slot,
      remarks: entity.remarks,
      totalStudents: records.length,
      presentCount,
      absentCount,
      records,
      createdAt: entity.createdAt,
    };
  }
}
