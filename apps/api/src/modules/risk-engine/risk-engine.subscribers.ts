import { IEventBus } from '../../events/event-bus.interface.js';
import { RISK_EVENTS, RiskComputedPayload, RiskDetectedPayload } from './risk-engine.events.js';
import { ATTENDANCE_EVENTS, AttendanceMarkedPayload } from '../attendance/attendance.events.js';
import { TEST_EVENTS, TestResultReadyPayload } from '../tests/test.events.js';
import { FEE_EVENTS, FeePaidPayload } from '../fees/fee.events.js';
import { RiskEngineService } from './risk-engine.service.js';
import { DomainEvent } from '@trueco/types';
import { logger } from '../../common/logger/logger.service.js';

export class RiskEngineSubscribers {
  public static register(eventBus: IEventBus, riskService?: RiskEngineService): void {
    eventBus.subscribe(RISK_EVENTS.RISK_COMPUTED, (event: DomainEvent<RiskComputedPayload>) => {
      logger.debug(
        `[RiskSubscribers] Risk score computed for student ${event.payload.studentId}: ${event.payload.score} (${event.payload.level})`,
      );
    });

    eventBus.subscribe(RISK_EVENTS.RISK_DETECTED, (event: DomainEvent<RiskDetectedPayload>) => {
      logger.warn(
        `⚠️ [RiskSubscribers] HIGH/CRITICAL RISK DETECTED: Student ${event.payload.studentId} has score ${event.payload.score} [${event.payload.level}]. Narrative: ${event.payload.narrative}`,
      );
    });

    // Event-driven automatic score recomputation
    if (riskService) {
      eventBus.subscribe(
        ATTENDANCE_EVENTS.ATTENDANCE_MARKED,
        async (event: DomainEvent<AttendanceMarkedPayload>) => {
          for (const record of event.payload.records) {
            if (record.status === 'ABSENT') {
              try {
                await riskService.computeStudentRisk(
                  record.studentId,
                  event.payload.coachingId,
                  event.metadata?.correlationId,
                );
              } catch (err) {
                logger.debug(`[RiskSubscribers] Recompute skipped for student ${record.studentId}: ${err}`);
              }
            }
          }
        },
      );

      eventBus.subscribe(
        TEST_EVENTS.TEST_RESULT_READY,
        async (event: DomainEvent<TestResultReadyPayload>) => {
          try {
            await riskService.computeStudentRisk(
              event.payload.studentId,
              event.payload.coachingId,
              event.metadata?.correlationId,
            );
          } catch (err) {
            logger.debug(`[RiskSubscribers] Recompute skipped for student ${event.payload.studentId}: ${err}`);
          }
        },
      );

      eventBus.subscribe(
        FEE_EVENTS.FEE_PAID,
        async (event: DomainEvent<FeePaidPayload>) => {
          try {
            await riskService.computeStudentRisk(
              event.payload.studentId,
              event.payload.coachingId,
              event.metadata?.correlationId,
            );
          } catch (err) {
            logger.debug(`[RiskSubscribers] Recompute skipped for student ${event.payload.studentId}: ${err}`);
          }
        },
      );
    }
  }
}
