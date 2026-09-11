export interface CreateTestDto {
  readonly batchId: string;
  readonly title: string;
  readonly subject: string;
  readonly testDate: string; // YYYY-MM-DD
  readonly totalMarks: number;
  readonly passingMarks?: number;
}

export interface StudentMarkEntryDto {
  readonly studentId: string;
  readonly marksObtained: number;
  readonly isAbsent?: boolean;
  readonly remarks?: string;
}

export interface UploadMarksDto {
  readonly results: StudentMarkEntryDto[];
}

export interface TestResultResponseDto {
  readonly id: string;
  readonly studentId: string;
  readonly studentName: string;
  readonly marksObtained: number;
  readonly isAbsent: boolean;
  readonly percentage: number;
  readonly remarks?: string | null;
}

export interface TestResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly batchId: string;
  readonly title: string;
  readonly subject: string;
  readonly testDate: Date;
  readonly totalMarks: number;
  readonly passingMarks?: number | null;
  readonly averageScore?: number;
  readonly highestScore?: number;
  readonly results?: TestResultResponseDto[];
  readonly createdAt: Date;
}
