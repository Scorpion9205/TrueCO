import { RoleType } from '@trueco/types';

export class DashboardPolicy {
  public static canViewOwnerDashboard(roles: RoleType[]): boolean {
    return roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER);
  }

  public static canViewTeacherDashboard(roles: RoleType[]): boolean {
    return (
      roles.includes(RoleType.SUPER_ADMIN) ||
      roles.includes(RoleType.OWNER) ||
      roles.includes(RoleType.TEACHER)
    );
  }
}
