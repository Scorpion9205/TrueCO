import { BatchResponseDto } from './dto/batch.dto.js';

export class BatchMapper {
  public static toResponseDto(entity: any): BatchResponseDto {
    const activeStudentCount = Array.isArray(entity.batchStudents)
      ? entity.batchStudents.filter((bs: any) => bs.leftAt === null).length
      : 0;

    const teachers = Array.isArray(entity.teacherBatches)
      ? entity.teacherBatches.map((tb: any) => ({
          teacherId: tb.teacherId,
          teacherName: tb.teacher ? tb.teacher.name : 'Unknown',
          isPrimary: tb.isPrimary,
        }))
      : [];

    return {
      id: entity.id,
      coachingId: entity.coachingId,
      name: entity.name,
      subject: entity.subject,
      academicYear: entity.academicYear,
      startTime: entity.startTime,
      endTime: entity.endTime,
      daysOfWeek: entity.daysOfWeek || [],
      isActive: entity.isActive,
      activeStudentCount,
      teachers,
      createdAt: entity.createdAt,
    };
  }
}
