import { RoleType } from '@vargly/types';

export class RbacPolicy {
  public static canManageRoles(roles: RoleType[]): boolean {
    return roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER);
  }

  public static canAssignRole(targetRoleCode: string, callerRoles: RoleType[]): boolean {
    if (callerRoles.includes(RoleType.SUPER_ADMIN)) return true;
    if (callerRoles.includes(RoleType.OWNER)) {
      // Owners cannot assign SUPER_ADMIN role
      return targetRoleCode !== RoleType.SUPER_ADMIN;
    }
    return false;
  }
}
