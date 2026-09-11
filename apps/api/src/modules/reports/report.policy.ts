import { RoleType } from '@trueco/types';

export class ReportPolicy {
  public static canViewReports(roles: RoleType[]): boolean {
    return roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER);
  }
}
