import { RoleType } from '@vargly/types';

export class ParentPolicy {
  public static canManageParents(roles: RoleType[]): boolean {
    return roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER);
  }
}
