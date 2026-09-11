import { RoleType } from '@trueco/types';

export class AttendancePolicy {
  public static canMarkAttendance(roles: RoleType[]): boolean {
    return (
      roles.includes(RoleType.SUPER_ADMIN) ||
      roles.includes(RoleType.OWNER) ||
      roles.includes(RoleType.TEACHER)
    );
  }
}
