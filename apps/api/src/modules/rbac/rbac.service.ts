import { StatusCodes } from 'http-status-codes';
import { IRbacRepository } from './rbac.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { RbacMapper } from './rbac.mapper.js';
import { RoleDto, PermissionDto, UserRoleAssignmentDto } from './dto/rbac.dto.js';
import { RbacPolicy } from './rbac.policy.js';
import { createRoleAssignedEvent } from './rbac.events.js';
import { RoleType } from '@vargly/types';

export class RbacService {
  public constructor(
    private readonly rbacRepository: IRbacRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async getRoles(coachingId?: string): Promise<RoleDto[]> {
    const roles = await this.rbacRepository.findRoles(coachingId);
    return roles.map(RbacMapper.toRoleDto);
  }

  public async getPermissions(): Promise<PermissionDto[]> {
    const permissions = await this.rbacRepository.findPermissions();
    return permissions.map(RbacMapper.toPermissionDto);
  }

  public async assignRoleToUser(
    userId: string,
    roleCode: string,
    coachingId: string,
    assignedBy?: string,
    callerRoles: RoleType[] = [],
    correlationId: string = crypto.randomUUID(),
  ): Promise<UserRoleAssignmentDto> {
    // 1. Policy check
    if (!RbacPolicy.canAssignRole(roleCode, callerRoles)) {
      throw new AppError('FORBIDDEN', `You are not authorized to assign role '${roleCode}'`, StatusCodes.FORBIDDEN);
    }

    // 2. Find Role
    const role = await this.rbacRepository.findRoleByCode(roleCode, coachingId);
    if (!role) {
      throw new AppError('NOT_FOUND', `Role with code '${roleCode}' not found`, StatusCodes.NOT_FOUND);
    }

    // 3. Assign
    const assignment = await this.rbacRepository.assignRole(userId, role.id, coachingId);

    // 4. Emit Domain Event
    await this.eventBus.publish(
      createRoleAssignedEvent(
        {
          userId,
          roleCode,
          coachingId,
          assignedBy,
        },
        correlationId,
      ),
    );

    return {
      userId: assignment.userId,
      roleId: assignment.roleId,
      roleCode,
      coachingId,
      assignedAt: assignment.createdAt,
    };
  }
}
