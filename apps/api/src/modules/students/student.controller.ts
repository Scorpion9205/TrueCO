import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { StudentService } from './student.service.js';
import { createStudentSchema, updateStudentSchema } from './validators/student.validator.js';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto.js';
import { RequestContextService } from '../../common/services/request-context.service.js';

export class StudentController {
  public constructor(private readonly studentService: StudentService) {}

  public create = async (req: Request, res: Response): Promise<void> => {
    const validated = createStudentSchema.parse(req.body) as CreateStudentDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const student = await this.studentService.enrollStudent(validated, coachingId, userId, traceId);
    res.status(StatusCodes.CREATED).json({ data: student });
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const student = await this.studentService.getStudentById(req.params.id);
    res.status(StatusCodes.OK).json({ data: student });
  };

  public list = async (req: Request, res: Response): Promise<void> => {
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
    const search = req.query.search as string | undefined;

    const students = await this.studentService.listStudents({ isActive, search });
    res.status(StatusCodes.OK).json({ data: students });
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const validated = updateStudentSchema.parse(req.body) as UpdateStudentDto;
    const coachingId = RequestContextService.getRequiredCoachingId();
    const userId = RequestContextService.getUserId();
    const traceId = RequestContextService.getTraceId();

    const student = await this.studentService.updateStudent(req.params.id, validated, coachingId, userId, traceId);
    res.status(StatusCodes.OK).json({ data: student });
  };

  public delete = async (req: Request, res: Response): Promise<void> => {
    await this.studentService.deleteStudent(req.params.id);
    res.status(StatusCodes.OK).json({ data: { message: 'Student removed successfully' } });
  };
}
