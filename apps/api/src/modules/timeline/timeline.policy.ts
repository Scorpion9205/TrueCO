import { RoleType } from '@trueco/types';

export class TimelinePolicy {
  public static canReadTimeline(roles: RoleType[]): boolean {
    return (
      roles.includes(RoleType.SUPER_ADMIN) ||
      roles.includes(RoleType.OWNER) ||
      roles.includes(RoleType.TEACHER)
    );
  }
}
