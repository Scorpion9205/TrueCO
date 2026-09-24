import { StudentResponseDto } from './dto/student.dto.js';

export class StudentMapper {
  public static toResponseDto(entity: any): StudentResponseDto {
    return {
      id: entity.id,
      coachingId: entity.coachingId,
      rollNumber: entity.rollNumber,
      firstName: entity.firstName,
      lastName: entity.lastName,
      gender: entity.gender,
      dob: entity.dob ? new Date(entity.dob) : null,
      phone: entity.phone,
      email: entity.email,
      address: entity.address,
      joiningDate: new Date(entity.joiningDate),
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      ...(entity.studentParents
        ? {
            parents: entity.studentParents
              .filter((link: any) => link.parent && !link.parent.deletedAt)
              .map((link: any) => ({
                id: link.parent.id,
                name: link.parent.name,
                phone: link.parent.phone,
                email: link.parent.email,
                relation: link.parent.relation,
                isPrimary: link.isPrimary,
              })),
          }
        : {}),
      ...(entity.batchStudents
        ? {
            batches: entity.batchStudents
              .filter((enrolment: any) => !enrolment.leftAt && enrolment.batch)
              .map((enrolment: any) => ({
                id: enrolment.batch.id,
                name: enrolment.batch.name,
                subject: enrolment.batch.subject,
              })),
          }
        : {}),
    };
  }
}
