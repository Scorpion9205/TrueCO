import { RoleType } from '@vargly/types';

export class ExpensePolicy {
  public static canManageExpenses(roles: RoleType[]): boolean {
    return (
      roles.includes(RoleType.SUPER_ADMIN) ||
      roles.includes(RoleType.OWNER)
    );
  }
}
