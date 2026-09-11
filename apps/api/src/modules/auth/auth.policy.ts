import { RoleType } from '@trueco/types';

export class AuthPolicy {
  public static canRevokeAllTokens(currentUserId?: string, targetUserId?: string, roles: RoleType[] = []): boolean {
    if (roles.includes(RoleType.SUPER_ADMIN)) return true;
    if (roles.includes(RoleType.OWNER)) return true;
    return currentUserId === targetUserId;
  }
}
