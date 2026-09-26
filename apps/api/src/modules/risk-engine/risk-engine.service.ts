import { StatusCodes } from 'http-status-codes';
import { IRiskEngineRepository } from './risk-engine.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { RiskFilterDto, RiskScoreResponseDto } from './dto/risk-engine.dto.js';
import { RiskEngineMapper } from './risk-engine.mapper.js';
import { createRiskComputedEvent, createRiskDetectedEvent } from './risk-engine.events.js';
import { FeeInstallmentStatus, RiskLevel } from '@vargly/types';

export class RiskEngineService {
  public constructor(
    private readonly riskRepository: IRiskEngineRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async computeStudentRisk(
    studentId: string,
    coachingId: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<RiskScoreResponseDto> {
    const data = await this.riskRepository.getStudentAcademicData(studentId);
    if (!data || data.student.coachingId !== coachingId) {
      throw new AppError('STUDENT_NOT_FOUND', 'Student record not found', StatusCodes.NOT_FOUND);
    }

    const narrativeParts: string[] = [];

    // 1. Attendance Factor (35% weight)
    let attendanceFactor = 0;
    const records = data.attendanceRecords;
    if (records.length > 0) {
      const attended = records.filter(
        (r: any) => r.status === 'PRESENT' || r.status === 'LATE',
      ).length;
      const attPercentage = (attended / records.length) * 100;

      if (attPercentage < 75) {
        attendanceFactor = Math.min(100, Number((((75 - attPercentage) / 75) * 100).toFixed(1)));
        narrativeParts.push(`Low attendance (${attPercentage.toFixed(0)}%)`);
      }
    }

    // 2. Marks Factor (30% weight)
    let marksFactor = 0;
    const tests = data.testResults;
    if (tests.length > 0) {
      let totalPerc = 0;
      let validTests = 0;

      for (const t of tests) {
        const totalMarks = Number(t.test?.totalMarks || 0);
        if (totalMarks > 0) {
          totalPerc += (Number(t.marksObtained) / totalMarks) * 100;
          validTests++;
        }
      }

      const avgMarks = validTests > 0 ? totalPerc / validTests : 100;
      if (avgMarks < 60) {
        marksFactor = Math.min(100, Number((((60 - avgMarks) / 60) * 100).toFixed(1)));
        narrativeParts.push(`Declining test performance (average: ${avgMarks.toFixed(0)}%)`);
      }
    }

    // 3. Fee Factor (20% weight)
    let feeFactor = 0;
    const now = new Date();
    const overdueInstallments = data.feeInstallments.filter((i: any) => {
      const isUnpaid =
        i.status === FeeInstallmentStatus.PENDING ||
        i.status === FeeInstallmentStatus.PARTIAL ||
        i.status === FeeInstallmentStatus.OVERDUE;
      return isUnpaid && new Date(i.dueDate) < now;
    });

    if (overdueInstallments.length > 0) {
      let maxOverdueDays = 0;
      let totalOverdueAmount = 0;

      for (const inst of overdueInstallments) {
        const diffDays = Math.ceil(
          (now.getTime() - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24),
        );
        maxOverdueDays = Math.max(maxOverdueDays, diffDays);
        totalOverdueAmount += Number(inst.amount) - Number(inst.paidAmount || 0);
      }

      feeFactor = Math.min(100, overdueInstallments.length * 30 + maxOverdueDays * 1.5);
      narrativeParts.push(
        `${overdueInstallments.length} fee installment(s) overdue (₹${totalOverdueAmount} pending)`,
      );
    }

    // 4. Homework Factor (15% weight)
    let homeworkFactor = 0;
    const pastHomework = data.homeworkList.filter((h: any) => new Date(h.dueDate) < now);
    if (pastHomework.length > 0) {
      // In Vargly, missed homework entries increase risk
      homeworkFactor = Math.min(100, pastHomework.length * 15);
      if (homeworkFactor > 30) {
        narrativeParts.push(`${pastHomework.length} missed/pending homework assignments`);
      }
    }

    // 5. Composite Score Computation
    const rawScore =
      0.35 * attendanceFactor +
      0.30 * marksFactor +
      0.20 * feeFactor +
      0.15 * homeworkFactor;

    const score = Math.min(100, Number(rawScore.toFixed(2)));

    // 6. Level Assignment
    let level: RiskLevel = RiskLevel.LOW;
    if (score > 75) {
      level = RiskLevel.CRITICAL;
    } else if (score > 50) {
      level = RiskLevel.HIGH;
    } else if (score > 25) {
      level = RiskLevel.MEDIUM;
    }

    const narrative =
      narrativeParts.length > 0
        ? narrativeParts.join('; ') + '.'
        : 'Student academic, attendance, and fee indicators are within healthy thresholds.';

    // 7. Persist Evaluation
    const saved = await this.riskRepository.upsertRiskScore({
      coachingId,
      studentId,
      score,
      level,
      attendanceFactor,
      marksFactor,
      feeFactor,
      homeworkFactor,
      narrative,
    });

    const responseDto = RiskEngineMapper.toResponseDto(saved);

    // 8. Emit Domain Events
    await this.eventBus.publish(
      createRiskComputedEvent(
        {
          coachingId,
          studentId,
          score,
          level,
        },
        correlationId,
      ),
    );

    if (level === RiskLevel.HIGH || level === RiskLevel.CRITICAL) {
      await this.eventBus.publish(
        createRiskDetectedEvent(
          {
            coachingId,
            studentId,
            score,
            level,
            narrative,
          },
          correlationId,
        ),
      );
    }

    return responseDto;
  }

  public async recomputeAll(coachingId: string): Promise<number> {
    const studentIds = await this.riskRepository.getAllActiveStudentIds(coachingId);
    for (const sId of studentIds) {
      await this.computeStudentRisk(sId, coachingId);
    }
    return studentIds.length;
  }

  public async getStudentRisk(studentId: string, coachingId: string): Promise<RiskScoreResponseDto> {
    const record = await this.riskRepository.findByStudentId(studentId);
    if (!record) {
      return this.computeStudentRisk(studentId, coachingId);
    }
    if (record.coachingId !== coachingId) {
      throw new AppError('RISK_NOT_FOUND', 'Risk score not found', StatusCodes.NOT_FOUND);
    }
    return RiskEngineMapper.toResponseDto(record);
  }

  public async listRiskScores(
    coachingId: string,
    filter?: RiskFilterDto,
  ): Promise<RiskScoreResponseDto[]> {
    const list = await this.riskRepository.findMany(coachingId, filter);
    return list.map(RiskEngineMapper.toResponseDto);
  }
}
