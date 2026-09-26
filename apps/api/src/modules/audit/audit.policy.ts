import { RoleType } from '@vargly/types';

export class AuditPolicy {
  public static canReadAudit(roles: RoleType[]): boolean {
    return (
      roles.includes(RoleType.SUPER_ADMIN) ||
      roles.includes(RoleType.OWNER)
    );
  }
}
