import { RoleType } from '@vargly/types';

export class TestPolicy {
  public static canManageTests(roles: RoleType[]): boolean {
    return (
      roles.includes(RoleType.SUPER_ADMIN) ||
      roles.includes(RoleType.OWNER) ||
      roles.includes(RoleType.TEACHER)
    );
  }
}
