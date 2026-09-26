import { describe, expect, it } from 'vitest';
import { FeeInstallmentStatus } from '@vargly/types';
import { FeeMapper } from '../../modules/fees/fee.mapper.js';

const plan = (installments: any[]) => ({
  id: 'p1',
  coachingId: 'c1',
  studentId: 's1',
  totalAmount: '11000.00',
  finalAmount: '10000.00',
  academicYear: '2026-27',
  createdAt: new Date(),
  installments,
});

describe('FeeMapper.toPlanDto', () => {
  it('does not count waived remainders as pending', () => {
    const dto = FeeMapper.toPlanDto(
      plan([
        { amount: '3333.33', paidAmount: '2000.00', status: FeeInstallmentStatus.PARTIAL },
        { amount: '3333.33', paidAmount: '0', status: FeeInstallmentStatus.PENDING },
        { amount: '3333.34', paidAmount: '0', status: FeeInstallmentStatus.WAIVED },
      ]),
    );

    expect(dto.totalPaid).toBe(2000);
    expect(dto.totalWaived).toBe(3333.34);
    expect(dto.totalPending).toBe(4666.66);
    expect(dto.installments?.[2]?.balanceAmount).toBe(0);
    expect(dto.installments?.[0]?.balanceAmount).toBe(1333.33);
  });

  it('sums paise exactly (no floating-point drift)', () => {
    const dto = FeeMapper.toPlanDto({
      ...plan(
        Array.from({ length: 3 }, () => ({
          amount: '0.10',
          paidAmount: '0.10',
          status: FeeInstallmentStatus.PAID,
        })),
      ),
      finalAmount: '0.30',
    });

    // 0.1 + 0.1 + 0.1 is 0.30000000000000004 in plain JavaScript
    expect(dto.totalPaid).toBe(0.3);
    expect(dto.totalPending).toBe(0);
  });
});
