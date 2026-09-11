import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { RequestContextService } from '../services/request-context.service.js';
import { AppError } from '../middleware/error-handler.middleware.js';

export function requirePermission(permission: string) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    if (!RequestContextService.hasPermission(permission)) {
      throw new AppError(
        'FORBIDDEN',
        `Access denied: required permission '${permission}' is missing`,
        StatusCodes.FORBIDDEN,
        { requiredPermission: permission },
      );
    }
    next();
  };
}

export function RequirePermission(permission: string) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (!RequestContextService.hasPermission(permission)) {
        throw new AppError(
          'FORBIDDEN',
          `Access denied: required permission '${permission}' is missing`,
          StatusCodes.FORBIDDEN,
          { requiredPermission: permission },
        );
      }
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
