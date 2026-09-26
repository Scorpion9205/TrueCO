import { RoleType } from '@vargly/types';

export class BatchPolicy {
  public static canManageBatches(roles: RoleType[]): boolean {
    return roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER);
  }
}
