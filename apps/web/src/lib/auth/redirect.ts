export const APP_HOME = '/app';

/**
 * The page to go to after signing in. Only same-site paths are accepted, so a crafted link like
 * /login?next=https://evil.example cannot bounce a user to another site.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return APP_HOME;
  }
  return next;
}
