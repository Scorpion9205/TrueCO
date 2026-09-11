import { TeacherResponseDto } from './dto/teacher.dto.js';

export class TeacherMapper {
  public static toResponseDto(entity: any): TeacherResponseDto {
    const assignedBatches = (entity.teacherBatches || []).map((tb: any) => ({
      batchId: tb.batchId,
      batchName: tb.batch ? tb.batch.name : 'Unknown',
      isPrimary: tb.isPrimary,
    }));

    return {
      id: entity.id,
      coachingId: entity.coachingId,
      userId: entity.userId,
      name: entity.name,
      phone: entity.phone,
      email: entity.email,
      specialization: entity.specialization,
      monthlySalary: entity.monthlySalary ? Number(entity.monthlySalary) : null,
      joiningDate: new Date(entity.joiningDate),
      isActive: entity.isActive,
      assignedBatches,
      createdAt: entity.createdAt,
    };
  }
}
