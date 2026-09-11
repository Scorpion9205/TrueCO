import { StatusCodes } from 'http-status-codes';
import { ISalaryRepository } from './salary.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import {
  GenerateSalaryDto,
  RecordSalaryPaymentDto,
  SalaryFilterDto,
  SalaryResponseDto,
} from './dto/salary.dto.js';
import { SalaryMapper } from './salary.mapper.js';
import { createSalaryGeneratedEvent, createSalaryPaidEvent } from './salary.events.js';

export class SalaryService {
  public constructor(
    private readonly salaryRepository: ISalaryRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async generateSalary(
    dto: GenerateSalaryDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<SalaryResponseDto> {
    let amount = dto.amount;
    if (amount === undefined) {
      const defaultSalary = await this.salaryRepository.getTeacherMonthlySalary(dto.teacherId);
      if (defaultSalary === null) {
        throw new AppError(
          'SALARY_AMOUNT_REQUIRED',
          'Teacher monthly salary is not configured; amount must be specified explicitly',
          StatusCodes.BAD_REQUEST,
        );
      }
      amount = defaultSalary;
    }

    const salary = await this.salaryRepository.create({
      coachingId,
      teacherId: dto.teacherId,
      amount,
      month: dto.month,
      year: dto.year,
      remarks: dto.remarks,
    });

    const responseDto = SalaryMapper.toResponseDto(salary);

    await this.eventBus.publish(
      createSalaryGeneratedEvent(
        {
          salaryId: responseDto.id,
          coachingId,
          teacherId: responseDto.teacherId,
          amount: responseDto.amount,
          month: responseDto.month,
          year: responseDto.year,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async paySalary(
    dto: RecordSalaryPaymentDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<SalaryResponseDto> {
    const existing = await this.salaryRepository.findById(dto.salaryId);
    if (!existing || existing.coachingId !== coachingId) {
      throw new AppError('SALARY_NOT_FOUND', 'Salary record not found', StatusCodes.NOT_FOUND);
    }

    if (existing.status === 'PAID') {
      throw new AppError('SALARY_ALREADY_PAID', 'This salary has already been paid', StatusCodes.BAD_REQUEST);
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    const updated = await this.salaryRepository.recordPayment(dto.salaryId, {
      paymentMethod: dto.paymentMethod,
      paidAt,
      remarks: dto.remarks,
    });

    const responseDto = SalaryMapper.toResponseDto(updated);

    await this.eventBus.publish(
      createSalaryPaidEvent(
        {
          salaryId: responseDto.id,
          coachingId,
          teacherId: responseDto.teacherId,
          amount: responseDto.amount,
          paymentMethod: dto.paymentMethod,
          paidAt,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async getSalaries(coachingId: string, filter?: SalaryFilterDto): Promise<SalaryResponseDto[]> {
    const list = await this.salaryRepository.findMany(coachingId, filter);
    return list.map(SalaryMapper.toResponseDto);
  }

  public async getTeacherSalaries(teacherId: string): Promise<SalaryResponseDto[]> {
    const list = await this.salaryRepository.findByTeacher(teacherId);
    return list.map(SalaryMapper.toResponseDto);
  }
}
