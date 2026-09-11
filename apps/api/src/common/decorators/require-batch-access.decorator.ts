import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { RequestContextService } from '../services/request-context.service.js';
import { getPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { RoleType } from '@trueco/types';
import { AppError } from '../middleware/error-handler.middleware.js';

export function requireBatchAccess() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const roles = RequestContextService.getRoles();
    if (roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER)) {
      return next();
    }

    const batchId = req.params.batchId || req.body.batchId;
    if (!batchId) {
      return next();
    }

    const userId = RequestContextService.getUserId();
    const coachingId = RequestContextService.getRequiredCoachingId();

    const prisma = getPrismaClient() as any;
    const teacher = await prisma.teacher.findFirst({
      where: { userId, coachingId, deletedAt: null },
      include: {
        teacherBatches: {
          where: { batchId },
        },
      },
    });

    if (!teacher || teacher.teacherBatches.length === 0) {
      throw new AppError(
        'FORBIDDEN_BATCH_ACCESS',
        'You do not have teaching permissions for this batch',
        StatusCodes.FORBIDDEN,
        { batchId },
      );
    }

    next();
  };
}
