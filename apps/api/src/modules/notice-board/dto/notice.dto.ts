export interface CreateNoticeDto {
  readonly title: string;
  readonly content: string;
  readonly batchId?: string | null;
  readonly targetAudience?: string; // 'ALL' | 'STUDENTS' | 'PARENTS' | 'TEACHERS'
  readonly isPinned?: boolean;
  readonly expiresAt?: string | null;
}

export interface UpdateNoticeDto {
  readonly title?: string;
  readonly content?: string;
  readonly batchId?: string | null;
  readonly targetAudience?: string;
  readonly isPinned?: boolean;
  readonly expiresAt?: string | null;
}

export interface NoticeResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly batchId?: string | null;
  readonly batchName?: string | null;
  readonly title: string;
  readonly content: string;
  readonly targetAudience: string;
  readonly isPinned: boolean;
  readonly expiresAt?: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NoticeFilterDto {
  readonly batchId?: string;
  readonly targetAudience?: string;
  readonly includeExpired?: boolean;
}
