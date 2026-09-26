import { RoleType } from '@vargly/types';

export class NoticePolicy {
  public static canManage(roles: RoleType[]): boolean {
    return roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER);
  }
}
