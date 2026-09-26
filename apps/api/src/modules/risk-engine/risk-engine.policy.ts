import { RoleType } from '@vargly/types';

export class RiskEnginePolicy {
  public static canViewRisk(roles: RoleType[]): boolean {
    return (
      roles.includes(RoleType.SUPER_ADMIN) ||
      roles.includes(RoleType.OWNER) ||
      roles.includes(RoleType.TEACHER)
    );
  }
}
