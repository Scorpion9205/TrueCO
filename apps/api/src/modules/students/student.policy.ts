import { RoleType } from '@vargly/types';

export class StudentPolicy {
  public static canManageStudents(roles: RoleType[]): boolean {
    return roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER);
  }

  public static canViewStudents(roles: RoleType[]): boolean {
    return (
      roles.includes(RoleType.SUPER_ADMIN) ||
      roles.includes(RoleType.OWNER) ||
      roles.includes(RoleType.TEACHER)
    );
  }
}
