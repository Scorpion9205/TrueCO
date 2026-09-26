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

/** null clears an optional detail; an omitted field is left unchanged */
export interface UpdateStudentDto {
  readonly rollNumber?: string | null;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly gender?: string | null;
  readonly dob?: string | null;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly address?: string | null;
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
  /** Included when a single student is fetched */
  readonly parents?: Array<{
    readonly id: string;
    readonly name: string;
    readonly phone: string;
    readonly email?: string | null;
    readonly relation: string;
    readonly isPrimary: boolean;
  }>;
  /** Current batches; included when a single student is fetched */
  readonly batches?: Array<{
    readonly id: string;
    readonly name: string;
    readonly subject?: string | null;
  }>;
}

export interface StudentListFilters {
  readonly isActive?: boolean;
  readonly search?: string;
  /** Only students currently in one of these batches (a teacher's own); omit for everyone */
  readonly batchIds?: string[];
}
