import { IEventBus } from '../../events/event-bus.interface.js';
import { RBAC_EVENTS, RoleAssignedPayload } from './rbac.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { DomainEvent } from '@trueco/types';

export class RbacSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(RBAC_EVENTS.ROLE_ASSIGNED, (event: DomainEvent<RoleAssignedPayload>) => {
      logger.info(`[Audit] Role '${event.payload.roleCode}' assigned to user ${event.payload.userId}`, {
        coachingId: event.payload.coachingId,
        assignedBy: event.payload.assignedBy,
      });
    });
  }
}
