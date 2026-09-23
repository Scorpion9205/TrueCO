import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { RequestContextService } from '../services/request-context.service.js';
import { getPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { RoleType } from '@trueco/types';
import { AppError } from '../middleware/error-handler.middleware.js';

/**
 * What the request identifies, and so how its batch is found:
 * - batch / homework / test / attendanceSession: the record's batch must be taught by the teacher
 * - student: the student must be actively enrolled in one of the teacher's batches
 * - teacher: teachers may only act on their own profile
 */
export type BatchScopedResource =
  'batch' | 'homework' | 'test' | 'attendanceSession' | 'student' | 'teacher';

export interface BatchAccessOptions {
  readonly resource?: BatchScopedResource;
  /** Where the identifier is read from. Defaults to route params. */
  readonly source?: 'params' | 'body';
  /** Field holding the identifier. Defaults to "batchId" for batches, otherwise "id". */
  readonly key?: string;
}

const db = () => getPrismaClient() as any;

async function batchIdOf(
  resource: BatchScopedResource,
  id: string,
): Promise<string | null | undefined> {
  const select = { select: { batchId: true } };
  switch (resource) {
    case 'batch':
      return id;
    case 'homework':
      return (await db().homework.findUnique({ where: { id }, ...select }))?.batchId ?? null;
    case 'test':
      return (await db().test.findUnique({ where: { id }, ...select }))?.batchId ?? null;
    case 'attendanceSession':
      return (
        (await db().attendanceSession.findUnique({ where: { id }, ...select }))?.batchId ?? null
      );
    default:
      return undefined;
  }
}

function forbidden(message: string, details: Record<string, unknown>): AppError {
  return new AppError('FORBIDDEN_BATCH_ACCESS', message, StatusCodes.FORBIDDEN, details);
}

/**
 * Confines teachers to the batches they are assigned to. Owners and platform admins pass.
 * A teacher request whose batch cannot be determined is refused rather than allowed.
 */
export function requireBatchAccess(options: BatchAccessOptions = {}) {
  const resource = options.resource ?? 'batch';
  const source = options.source ?? (resource === 'batch' ? 'any' : 'params');
  const key = options.key ?? (resource === 'batch' ? 'batchId' : 'id');

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const roles = RequestContextService.getRoles();
    if (roles.includes(RoleType.SUPER_ADMIN) || roles.includes(RoleType.OWNER)) {
      return next();
    }

    const id: unknown =
      source === 'params'
        ? req.params[key]
        : source === 'body'
          ? req.body?.[key]
          : (req.params[key] ?? req.body?.[key]);
    if (typeof id !== 'string' || !id) {
      throw forbidden('This request does not identify a batch you teach', { resource, key });
    }

    const teacher = await db().teacher.findFirst({
      where: { userId: RequestContextService.getUserId(), isActive: true },
      include: { teacherBatches: { select: { batchId: true } } },
    });
    if (!teacher) {
      throw forbidden('Only assigned teachers can access batch records', { resource });
    }
    const taughtBatchIds = teacher.teacherBatches.map((tb: { batchId: string }) => tb.batchId);

    if (resource === 'teacher') {
      if (id !== teacher.id)
        throw forbidden('Teachers can only access their own profile', { teacherId: id });
      return next();
    }

    if (resource === 'student') {
      const enrolment = await db().batchStudent.findFirst({
        where: { studentId: id, leftAt: null, batchId: { in: taughtBatchIds } },
        select: { id: true },
      });
      if (!enrolment)
        throw forbidden('This student is not in a batch you teach', { studentId: id });
      return next();
    }

    const batchId = await batchIdOf(resource, id);
    // Missing record: let the handler return its usual 404
    if (batchId === null) return next();
    if (!batchId || !taughtBatchIds.includes(batchId)) {
      throw forbidden('You do not have teaching permissions for this batch', {
        batchId: batchId ?? undefined,
      });
    }
    next();
  };
}
