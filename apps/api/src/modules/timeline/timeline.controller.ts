import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { TimelineService } from './timeline.service.js';
import { timelineFilterSchema } from './validators/timeline.validator.js';

export class TimelineController {
  public constructor(private readonly timelineService: TimelineService) {}

  public getTimeline = async (req: Request, res: Response): Promise<void> => {
    const studentId = req.params.studentId;
    const filter = timelineFilterSchema.parse(req.query);

    const result = await this.timelineService.getStudentTimeline(studentId, filter);
    res.status(StatusCodes.OK).json({ data: result });
  };
}
