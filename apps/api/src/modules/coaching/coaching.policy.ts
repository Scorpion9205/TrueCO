import { RoleType } from '@trueco/types';

export class CoachingPolicy {
  public static canUpdateCoaching(callerCoachingId?: string, targetCoachingId?: string, roles: RoleType[] = []): boolean {
    if (roles.includes(RoleType.SUPER_ADMIN)) return true;
    if (roles.includes(RoleType.OWNER) && callerCoachingId === targetCoachingId) return true;
    return false;
  }
}
