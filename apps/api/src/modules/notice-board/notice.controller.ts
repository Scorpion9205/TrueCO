import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { NoticeService } from './notice.service.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import {
  createNoticeSchema,
  noticeFilterSchema,
  updateNoticeSchema,
} from './validators/notice.validator.js';

export class NoticeController {
  public constructor(private readonly noticeService: NoticeService) {}

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const userId = RequestContextService.getUserId();
      const traceId = RequestContextService.getTraceId();

      const validated = createNoticeSchema.parse(req.body);
      const notice = await this.noticeService.createNotice(validated, coachingId, userId, traceId);

      res.status(StatusCodes.CREATED).json({ data: notice });
    } catch (err) {
      next(err);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const userId = RequestContextService.getUserId();
      const traceId = RequestContextService.getTraceId();

      const validated = updateNoticeSchema.parse(req.body);
      const notice = await this.noticeService.updateNotice(
        req.params.id,
        validated,
        coachingId,
        userId,
        traceId,
      );

      res.status(StatusCodes.OK).json({ data: notice });
    } catch (err) {
      next(err);
    }
  };

  public delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const userId = RequestContextService.getUserId();
      const traceId = RequestContextService.getTraceId();

      await this.noticeService.deleteNotice(req.params.id, coachingId, userId, traceId);

      res.status(StatusCodes.NO_CONTENT).send();
    } catch (err) {
      next(err);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const notice = await this.noticeService.getNoticeById(req.params.id, coachingId);

      res.status(StatusCodes.OK).json({ data: notice });
    } catch (err) {
      next(err);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getCoachingId()!;
      const validated = noticeFilterSchema.parse(req.query);
      const notices = await this.noticeService.listNotices(coachingId, validated);

      res.status(StatusCodes.OK).json({ data: notices });
    } catch (err) {
      next(err);
    }
  };
}
