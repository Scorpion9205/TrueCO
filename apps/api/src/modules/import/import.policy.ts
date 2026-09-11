import { RoleType } from '@trueco/types';

export class ImportPolicy {
  public static canImport(roles: RoleType[]): boolean {
    return roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER);
  }
}
