// Cookie names are shared by the route handlers (set/clear) and the middleware (read)

/** Refresh token: httpOnly and sent only to /api/auth, so page scripts can never read it */
export const REFRESH_COOKIE = 'trueco_rt';

/**
 * Non-secret "probably signed in" marker readable by the middleware on every page, so /app can
 * redirect to /login without a round trip. The refresh cookie decides whether the session is real.
 */
export const SESSION_FLAG_COOKIE = 'trueco_session';

/** Matches the API's refresh token lifetime (auth.service: 7 days) */
export const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
