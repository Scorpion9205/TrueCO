import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RequestContextData, RoleType } from '@trueco/types';
import { RequestContextService } from '../services/request-context.service.js';

export function tenantContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const traceId = (req.headers['x-trace-id'] as string) || uuidv4();
  const coachingId = (req.headers['x-coaching-id'] as string) || undefined;
  const userId = (req.headers['x-user-id'] as string) || undefined;
  const rolesHeader = req.headers['x-user-roles'] as string;
  const permissionsHeader = req.headers['x-user-permissions'] as string;

  const roles: RoleType[] = rolesHeader
    ? (rolesHeader.split(',').map((r) => r.trim()) as RoleType[])
    : [];

  const permissions: string[] = permissionsHeader
    ? permissionsHeader.split(',').map((p) => p.trim())
    : [];

  const contextData: RequestContextData = {
    traceId,
    coachingId,
    userId,
    roles,
    permissions,
    features: [],
  };

  RequestContextService.run(contextData, () => {
    next();
  });
}
