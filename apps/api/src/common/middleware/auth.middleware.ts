import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { tokenService } from '../security/token.service.js';
import { RequestContextService } from '../services/request-context.service.js';
import { AppError } from './error-handler.middleware.js';
import { RequestContextData } from '@trueco/types';

export function authenticateMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('UNAUTHORIZED', 'Missing or invalid Authorization header', StatusCodes.UNAUTHORIZED);
  }

  const token = authHeader.substring(7).trim();

  try {
    const payload = tokenService.verifyAccessToken(token);

    // Merge or update the RequestContextData with authenticated identity
    const currentContext = RequestContextService.getContext();
    const updatedContext: RequestContextData = {
      traceId: currentContext?.traceId || 'auth-trace',
      coachingId: payload.coachingId,
      userId: payload.sub,
      userEmail: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
      features: currentContext?.features || [],
    };

    // Run remaining middleware and handlers in the updated context
    RequestContextService.run(updatedContext, () => {
      next();
    });
  } catch (err) {
    throw new AppError('INVALID_TOKEN', 'Access token is expired or invalid', StatusCodes.UNAUTHORIZED);
  }
}
