import { RoleType } from '@trueco/types';

export class SalaryPolicy {
  public static canManageSalary(roles: RoleType[]): boolean {
    return (
      roles.includes(RoleType.SUPER_ADMIN) ||
      roles.includes(RoleType.OWNER)
    );
  }
}
