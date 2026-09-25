export interface CreateTeacherDto {
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly password: string;
  readonly specialization?: string;
  readonly monthlySalary?: number;
  readonly joiningDate?: string;
}

export interface UpdateTeacherDto {
  readonly name?: string;
  readonly phone?: string;
  readonly specialization?: string | null;
  readonly monthlySalary?: number | null;
  readonly isActive?: boolean;
}

export interface TeacherResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly userId: string;
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly specialization?: string | null;
  readonly monthlySalary?: number | null;
  readonly joiningDate: Date;
  readonly isActive: boolean;
  readonly assignedBatches?: Array<{
    readonly batchId: string;
    readonly batchName: string;
    readonly isPrimary: boolean;
  }>;
  readonly createdAt: Date;
}
