import { RiskScoreResponseDto } from './dto/risk-engine.dto.js';

export class RiskEngineMapper {
  public static toResponseDto(entity: any): RiskScoreResponseDto {
    return {
      id: entity.id,
      coachingId: entity.coachingId,
      studentId: entity.studentId,
      studentName: entity.student
        ? `${entity.student.firstName} ${entity.student.lastName}`.trim()
        : undefined,
      score: Number(entity.score),
      level: entity.level,
      factors: {
        attendanceFactor: Number(entity.attendanceFactor),
        marksFactor: Number(entity.marksFactor),
        feeFactor: Number(entity.feeFactor),
        homeworkFactor: Number(entity.homeworkFactor),
      },
      narrative: entity.narrative,
      computedAt: new Date(entity.computedAt),
    };
  }
}
