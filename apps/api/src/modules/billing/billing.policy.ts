import { RoleType } from '@trueco/types';

export class BillingPolicy {
  public static canManageBilling(roles: RoleType[]): boolean {
    return (
      roles.includes(RoleType.SUPER_ADMIN) ||
      roles.includes(RoleType.OWNER)
    );
  }
}
