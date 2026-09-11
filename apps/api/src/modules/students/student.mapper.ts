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
    };
  }
}
