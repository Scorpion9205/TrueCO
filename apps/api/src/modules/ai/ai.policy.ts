import { RoleType } from '@vargly/types';

export class AiPolicy {
  public static canGenerate(permissions: string[], roles: RoleType[]): boolean {
    if (roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER)) {
      return true;
    }
    if (roles.includes(RoleType.TEACHER)) {
      return true;
    }
    return permissions.includes('ai:generate') || permissions.includes('*');
  }

  public static canManageCredits(permissions: string[], roles: RoleType[]): boolean {
    if (roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER)) {
      return true;
    }
    return permissions.includes('ai:manage_credits') || permissions.includes('*');
  }

  public static canViewLogs(permissions: string[], roles: RoleType[]): boolean {
    if (roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER)) {
      return true;
    }
    return permissions.includes('ai:view_logs') || permissions.includes('*');
  }
}
