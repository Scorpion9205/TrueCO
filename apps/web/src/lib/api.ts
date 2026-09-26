import { createApiClient } from '@vargly/api-client';

/** Base URL of the Vargly API, e.g. http://localhost:4000/api/v1 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Client for public endpoints. Signed-in requests get their own client once auth lands (Phase 7.3). */
export const publicApi = createApiClient({ baseUrl: API_URL });
