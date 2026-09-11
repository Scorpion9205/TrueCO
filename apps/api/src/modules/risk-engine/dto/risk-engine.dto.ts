import { RiskLevel } from '@trueco/types';

export interface RiskFactorsDto {
  readonly attendanceFactor: number;
  readonly marksFactor: number;
  readonly feeFactor: number;
  readonly homeworkFactor: number;
}

export interface RiskScoreResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly studentId: string;
  readonly studentName?: string;
  readonly score: number;
  readonly level: RiskLevel;
  readonly factors: RiskFactorsDto;
  readonly narrative?: string | null;
  readonly computedAt: Date;
}

export interface RiskFilterDto {
  readonly level?: RiskLevel;
  readonly minScore?: number;
  readonly maxScore?: number;
}
