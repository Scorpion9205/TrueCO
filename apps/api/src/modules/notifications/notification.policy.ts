import { RoleType } from '@vargly/types';

export class NotificationPolicy {
  public static canManageNotifications(roles: RoleType[]): boolean {
    return (
      roles.includes(RoleType.SUPER_ADMIN) ||
      roles.includes(RoleType.OWNER)
    );
  }
}
