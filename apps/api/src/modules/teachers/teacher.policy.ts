import { RoleType } from '@trueco/types';

export class TeacherPolicy {
  public static canManageTeachers(roles: RoleType[]): boolean {
    return roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER);
  }
}
