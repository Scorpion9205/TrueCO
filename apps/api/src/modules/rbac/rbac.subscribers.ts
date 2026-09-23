import { IEventBus } from '../../events/event-bus.interface.js';
import { RBAC_EVENTS, RoleAssignedPayload } from './rbac.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { DomainEvent } from '@trueco/types';
import {
  IAccessCacheInvalidator,
  permissionResolver,
} from '../../common/security/permission-resolver.service.js';

export class RbacSubscribers {
  public static register(
    eventBus: IEventBus,
    accessInvalidator: IAccessCacheInvalidator = permissionResolver,
  ): void {
    eventBus.subscribe(RBAC_EVENTS.ROLE_ASSIGNED, async (event: DomainEvent<RoleAssignedPayload>) => {
      // Drop the cached access so the new role applies on the user's next request
      await accessInvalidator.invalidate(event.payload.userId);
      logger.info(`[Audit] Role '${event.payload.roleCode}' assigned to user ${event.payload.userId}`, {
        coachingId: event.payload.coachingId,
        assignedBy: event.payload.assignedBy,
      });
    });
  }
}
