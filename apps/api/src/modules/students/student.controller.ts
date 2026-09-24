import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { StudentService } from './student.service.js';
import {
  createStudentSchema,
  listStudentsQuerySchema,
  updateStudentSchema,
} from './validators/student.validator.js';
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
    const query = listStudentsQuerySchema.parse(req.query);
    const filters = {
      search: query.search || undefined,
      isActive: query.isActive === undefined ? undefined : query.isActive === 'true',
    };

    // Paged when asked (the web app always asks); otherwise the full list, as before
    if (query.page !== undefined || query.limit !== undefined) {
      const page = query.page ?? 1;
      const limit = query.limit ?? 25;
      const result = await this.studentService.listStudentsPage(filters, page, limit);
      res.status(StatusCodes.OK).json({ data: result.students, meta: { total: result.total, page, limit } });
      return;
    }

    const students = await this.studentService.listStudents(filters);
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
