import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiErrorResponse } from '@trueco/types';
import { logger } from '../logger/logger.service.js';

export class AppError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = StatusCodes.BAD_REQUEST,
    public readonly details?: Record<string, unknown> | Array<unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Prisma failures that describe the request, not a server fault. P2003 includes references
// rejected by the same-tenant triggers (another coaching's record).
const PRISMA_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  P2025: {
    status: StatusCodes.NOT_FOUND,
    code: 'NOT_FOUND',
    message: 'The requested record was not found',
  },
  P2002: {
    status: StatusCodes.CONFLICT,
    code: 'DUPLICATE_RECORD',
    message: 'A record with these details already exists',
  },
  P2003: {
    status: StatusCodes.BAD_REQUEST,
    code: 'INVALID_REFERENCE',
    message: 'The request refers to a record that does not exist in this coaching',
  },
};

export function errorHandlerMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // 1. Handle custom AppError
  if (err instanceof AppError) {
    logger.warn(`[AppError] ${err.code}: ${err.message}`, {
      statusCode: err.statusCode,
      url: req.originalUrl,
      method: req.method,
      details: err.details,
    });

    const response: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // 2. Handle Zod Validation Errors
  if (err instanceof ZodError) {
    logger.warn(`[ValidationError] Invalid payload for ${req.method} ${req.originalUrl}`, {
      issues: err.issues,
    });

    const response: ApiErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload validation failed',
        details: err.issues,
      },
    };

    res.status(StatusCodes.BAD_REQUEST).json(response);
    return;
  }

  // 3. Handle known Prisma request errors (not-found, duplicate, invalid reference)
  const prismaError =
    err instanceof Prisma.PrismaClientKnownRequestError ? PRISMA_ERRORS[err.code] : undefined;
  if (prismaError) {
    logger.warn(
      `[PrismaError] ${(err as Prisma.PrismaClientKnownRequestError).code} on ${req.method} ${req.originalUrl}`,
    );
    const response: ApiErrorResponse = {
      error: { code: prismaError.code, message: prismaError.message },
    };
    res.status(prismaError.status).json(response);
    return;
  }

  // 4. Handle Unexpected Server Errors
  logger.error(`[UnhandledError] Internal Server Error on ${req.method} ${req.originalUrl}`, err);

  const response: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred',
    },
  };

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(response);
}
