import { ParentResponseDto } from './dto/parent.dto.js';

export class ParentMapper {
  public static toResponseDto(entity: any): ParentResponseDto {
    const linkedStudents = (entity.studentParents || []).map((sp: any) => ({
      studentId: sp.studentId,
      studentName: sp.student ? `${sp.student.firstName} ${sp.student.lastName}` : 'Unknown',
      isPrimary: sp.isPrimary,
    }));

    return {
      id: entity.id,
      coachingId: entity.coachingId,
      name: entity.name,
      phone: entity.phone,
      email: entity.email,
      relation: entity.relation,
      linkedStudents,
      createdAt: entity.createdAt,
    };
  }
}
