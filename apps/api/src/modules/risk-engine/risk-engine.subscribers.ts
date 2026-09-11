import { IEventBus } from '../../events/event-bus.interface.js';
import { RISK_EVENTS, RiskComputedPayload, RiskDetectedPayload } from './risk-engine.events.js';
import { DomainEvent } from '@trueco/types';
import { logger } from '../../common/logger/logger.service.js';

export class RiskEngineSubscribers {
  public static register(eventBus: IEventBus): void {
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
  }
}
