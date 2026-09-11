export interface CreateStudentDto {
  readonly rollNumber?: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly gender?: string;
  readonly dob?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly address?: string;
  readonly joiningDate?: string;
}

export interface UpdateStudentDto {
  readonly rollNumber?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly gender?: string;
  readonly dob?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly address?: string;
  readonly isActive?: boolean;
}

export interface StudentResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly rollNumber?: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly gender?: string | null;
  readonly dob?: Date | null;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly address?: string | null;
  readonly joiningDate: Date;
  readonly isActive: boolean;
  readonly createdAt: Date;
}
