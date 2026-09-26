import { ExpenseResponseDto } from './dto/expense.dto.js';
import { PaymentMethod } from '@vargly/types';

export class ExpenseMapper {
  public static toResponseDto(entity: any): ExpenseResponseDto {
    return {
      id: entity.id,
      coachingId: entity.coachingId,
      title: entity.title,
      category: entity.category,
      amount: Number(entity.amount),
      expenseDate: new Date(entity.expenseDate),
      paymentMethod: entity.paymentMethod as PaymentMethod,
      receiptUrl: entity.receiptUrl,
      remarks: entity.remarks,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
    };
  }
}
