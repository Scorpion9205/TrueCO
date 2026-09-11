import { SalaryResponseDto } from './dto/salary.dto.js';
import { PaymentMethod } from '@trueco/types';

export class SalaryMapper {
  public static toResponseDto(entity: any): SalaryResponseDto {
    const teacherName = entity.teacher?.name || undefined;

    return {
      id: entity.id,
      coachingId: entity.coachingId,
      teacherId: entity.teacherId,
      teacherName,
      amount: Number(entity.amount),
      month: entity.month,
      year: entity.year,
      status: entity.status,
      paidAt: entity.paidAt ? new Date(entity.paidAt) : null,
      paymentMethod: entity.paymentMethod as PaymentMethod | null,
      remarks: entity.remarks,
      createdAt: new Date(entity.createdAt),
    };
  }
}
