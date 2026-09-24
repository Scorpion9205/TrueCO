/** Error envelope the TrueCO API returns: `{ error: { code, message, details? } }`. */
export interface ApiErrorBody {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
  readonly upgradeUrl?: string;
}

/**
 * Every failed request becomes an ApiError, so screens branch on `status` and `code` instead of
 * parsing responses. `status` is 0 when the request never reached the server.
 */
export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    /** Set on 402 responses: where the user can upgrade their plan */
    public readonly upgradeUrl?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Not signed in, or the session is no longer valid (expired token, deactivated account). */
  public get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** The coaching's trial or subscription has lapsed, or the plan lacks a feature. */
  public get isPaymentRequired(): boolean {
    return this.status === 402;
  }

  /** Signed in, but this user may not do this (role or batch restrictions). */
  public get isForbidden(): boolean {
    return this.status === 403;
  }

  public get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Request validation failed; `details` holds the per-field issues. */
  public get isValidation(): boolean {
    return this.code === 'VALIDATION_ERROR';
  }

  /** The server or network failed; retrying may help. Client errors (4xx) will not change on retry. */
  public get isRetryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
