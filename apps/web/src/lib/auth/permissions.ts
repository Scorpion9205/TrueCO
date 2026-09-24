import type { SessionUser } from './types';

/**
 * Whether the user holds a permission, mirroring the API's check (RequestContextService
 * .hasPermission): an exact code or the owner's "*" wildcard. This only decides what the UI
 * shows; the API enforces every permission itself.
 */
export function can(user: SessionUser | null | undefined, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes(permission) || user.permissions.includes('*');
}
