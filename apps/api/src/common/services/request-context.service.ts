import { AsyncLocalStorage } from 'node:async_hooks';
import { RequestContextData, RoleType } from '@trueco/types';

export class RequestContextService {
  private static readonly storage = new AsyncLocalStorage<RequestContextData>();

  public static run<R>(context: RequestContextData, callback: () => R): R {
    return RequestContextService.storage.run(context, callback);
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
