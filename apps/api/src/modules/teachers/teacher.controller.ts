import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { TeacherService } from './teacher.service.js';
import { createTeacherSchema, updateTeacherSchema } from './validators/teacher.validator.js';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/teacher.dto.js';
import { RequestContextService } from '../../common/services/request-context.service.js';

export class TeacherController {
  public constructor(private readonly teacherService: TeacherService) {}

  public create = async (req: Request, res: Response): Promise<void> => {
    const validated = createTeacherSchema.parse(req.body) as CreateTeacherDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const teacher = await this.teacherService.createTeacher(validated, coachingId, userId, traceId);
    res.status(StatusCodes.CREATED).json({ data: teacher });
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const teacher = await this.teacherService.getTeacherById(req.params.id);
    res.status(StatusCodes.OK).json({ data: teacher });
  };

  public list = async (req: Request, res: Response): Promise<void> => {
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
    const search = req.query.search as string | undefined;

    const teachers = await this.teacherService.listTeachers({ isActive, search });
    res.status(StatusCodes.OK).json({ data: teachers });
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const validated = updateTeacherSchema.parse(req.body) as UpdateTeacherDto;
    const teacher = await this.teacherService.updateTeacher(req.params.id, validated);
    res.status(StatusCodes.OK).json({ data: teacher });
  };
}
