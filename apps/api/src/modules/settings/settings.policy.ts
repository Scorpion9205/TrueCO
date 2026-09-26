import { RoleType } from '@vargly/types';

export class SettingsPolicy {
  public static canManage(roles: RoleType[]): boolean {
    return roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER);
  }
}
