import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { RequestContextData, RoleType } from '@vargly/types';

/**
 * Prisma queries are lazy: they execute when first awaited. A query returned from a context
 * callback would otherwise run after the context has exited, so start it while still inside.
 */
function startInsideContext<R>(result: R): R {
  if (result && typeof (result as any).then === 'function') {
    return new Promise((resolve, reject) => (result as any).then(resolve, reject)) as R;
  }
  return result;
}

type StoredContext = RequestContextData & {
  /** Set only by runAsSystem(): the database layer then skips tenant scoping. */
  readonly systemReason?: string;
};

export class RequestContextService {
  private static readonly storage = new AsyncLocalStorage<StoredContext>();

  public static run<R>(context: RequestContextData, callback: () => R): R {
    return RequestContextService.storage.run(context, callback);
  }

  /**
   * Runs work on behalf of one coaching outside an HTTP request (queue jobs, webhooks,
   * schedulers, event subscribers). All tenant-scoped queries inside are confined to it.
   * The trace and acting user are kept; request roles/permissions are not carried over.
   */
  public static runForTenant<R>(coachingId: string, callback: () => R): R {
    const current = RequestContextService.getContext();
    if (current?.coachingId === coachingId && !RequestContextService.isSystemContext()) {
      return startInsideContext(callback());
    }
    return RequestContextService.storage.run(
      {
        traceId: current?.traceId ?? randomUUID(),
        coachingId,
        userId: current?.userId,
        roles: [],
        permissions: [],
        features: [],
      },
      () => startInsideContext(callback()),
    );
  }

  /**
   * Runs deliberately cross-tenant work (identity lookup at login, provisioning a new
   * coaching, scanning all tenants for reminders). Tenant scoping and RLS are bypassed,
   * so writes must set coachingId explicitly. `reason` is recorded for auditing and logs.
   */
  public static runAsSystem<R>(reason: string, callback: () => R): R {
    const current = RequestContextService.getContext();
    return RequestContextService.storage.run(
      {
        traceId: current?.traceId ?? randomUUID(),
        userId: current?.userId,
        roles: [],
        permissions: [],
        features: [],
        systemReason: reason,
      },
      () => startInsideContext(callback()),
    );
  }

  public static isSystemContext(): boolean {
    return !!RequestContextService.storage.getStore()?.systemReason;
  }

  public static getSystemReason(): string | undefined {
    return RequestContextService.storage.getStore()?.systemReason;
  }

  public static getContext(): RequestContextData | undefined {
    return RequestContextService.storage.getStore();
  }

  public static getCoachingId(): string | undefined {
    return RequestContextService.getContext()?.coachingId;
  }

  public static getRequiredCoachingId(): string {
    const coachingId = RequestContextService.getCoachingId();
    if (!coachingId) {
      throw new Error('Tenant context missing: coachingId is required for this operation');
    }
    return coachingId;
  }

  public static getUserId(): string | undefined {
    return RequestContextService.getContext()?.userId;
  }

  public static getTraceId(): string {
    return RequestContextService.getContext()?.traceId ?? 'no-trace';
  }

  public static getRoles(): RoleType[] {
    return RequestContextService.getContext()?.roles ?? [];
  }

  public static getPermissions(): string[] {
    return RequestContextService.getContext()?.permissions ?? [];
  }

  public static hasPermission(permission: string): boolean {
    const permissions = RequestContextService.getPermissions();
    return permissions.includes(permission) || permissions.includes('*');
  }
}
