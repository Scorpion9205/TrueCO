export interface CreateParentDto {
  readonly name: string;
  readonly phone: string;
  readonly email?: string;
  readonly relation?: string; // FATHER, MOTHER, GUARDIAN
  readonly studentId?: string; // Optional student to link immediately
  readonly isPrimary?: boolean;
}

export interface LinkStudentParentDto {
  readonly studentId: string;
  readonly parentId: string;
  readonly isPrimary?: boolean;
}

export interface ParentResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly name: string;
  readonly phone: string;
  readonly email?: string | null;
  readonly relation: string;
  readonly linkedStudents?: Array<{
    readonly studentId: string;
    readonly studentName: string;
    readonly isPrimary: boolean;
  }>;
  readonly createdAt: Date;
}
