import { RoleType } from '@trueco/types';

export class FeePolicy {
  public static canManageFees(roles: RoleType[]): boolean {
    return (
      roles.includes(RoleType.SUPER_ADMIN) ||
      roles.includes(RoleType.OWNER)
    );
  }
}
