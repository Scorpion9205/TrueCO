import { IReportRepository } from './report.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import {
  AttendanceReportResponseDto,
  DefaulterItem,
  FeeReportResponseDto,
  ProfitLossResponseDto,
  ReportFilterDto,
  StudentAttendanceItem,
} from './dto/report.dto.js';
import { ReportMapper } from './report.mapper.js';
import { createReportGeneratedEvent } from './report.events.js';
import { FeeInstallmentStatus } from '@trueco/types';
import { money, Money, toRupees } from '../../common/money/money.js';
import { daysBetween, todayInIndia } from './report.dates.js';

const UNPAID = new Set<string>([
  FeeInstallmentStatus.PENDING,
  FeeInstallmentStatus.PARTIAL,
  FeeInstallmentStatus.OVERDUE,
]);

/** Share of a whole as a percentage with two decimals; null when there is no whole */
function percentOf(part: Money, whole: Money): number | null {
  if (whole.lte(0)) return null;
  return part.dividedBy(whole).times(100).toDecimalPlaces(2).toNumber();
}

export class ReportService {
  public constructor(
    private readonly reportRepository: IReportRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async generateFeeReport(
    coachingId: string,
    filter: ReportFilterDto = {},
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<{ data: FeeReportResponseDto; csv?: string }> {
    const { plans, installments } = await this.reportRepository.getFeeData(coachingId);
    const today = todayInIndia();

    const expected = plans.reduce((acc: Money, p: any) => acc.plus(money(p.finalAmount)), money(0));
    let collected = money(0);
    let waived = money(0);
    let overdue = money(0);
    const defaulters = new Map<string, { item: DefaulterItem; pending: Money }>();

    for (const inst of installments) {
      const paid = money(inst.paidAmount);
      const balance = money(inst.amount).minus(paid);
      collected = collected.plus(paid);
      // A waived balance is written off: not collected, and not owed either
      if (inst.status === FeeInstallmentStatus.WAIVED) {
        waived = waived.plus(balance);
        continue;
      }

      const dueDay = new Date(inst.dueDate).toISOString().slice(0, 10);
      if (!UNPAID.has(inst.status) || dueDay >= today || balance.lte(0)) continue;
      const student = inst.feePlan?.student;
      if (!student) continue;

      overdue = overdue.plus(balance);
      const existing = defaulters.get(student.id);
      if (existing) {
        // Instalments arrive oldest first, so the first one seen set the due date and days
        existing.pending = existing.pending.plus(balance);
        continue;
      }
      // Parents come primary first
      const parent = student.studentParents?.[0]?.parent;
      defaulters.set(student.id, {
        pending: balance,
        item: {
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`.trim(),
          studentPhone: student.phone ?? '',
          parentName: parent?.name?.trim() || undefined,
          parentPhone: parent?.phone,
          pendingAmount: 0,
          overdueDays: daysBetween(dueDay, today),
          installmentDueDate: dueDay,
        },
      });
    }

    const defaulterList = [...defaulters.values()]
      .map(({ item, pending }) => ({ ...item, pendingAmount: toRupees(pending) }))
      .sort((a, b) => b.pendingAmount - a.pendingAmount || b.overdueDays - a.overdueDays);

    const pending = expected.minus(collected).minus(waived);
    const reportDto: FeeReportResponseDto = {
      totalExpected: toRupees(expected),
      totalCollected: toRupees(collected),
      totalWaived: toRupees(waived),
      totalPending: toRupees(pending.lt(0) ? money(0) : pending),
      totalOverdue: toRupees(overdue),
      collectionPercentage: percentOf(collected, expected.minus(waived)),
      defaulterCount: defaulterList.length,
      defaulters: defaulterList,
    };

    let csv: string | undefined;
    if (filter.format === 'csv') {
      csv = ReportMapper.toCsv(defaulterList as any, [
        { key: 'studentName', label: 'Student Name' },
        { key: 'studentPhone', label: 'Phone' },
        { key: 'parentName', label: 'Parent Name' },
        { key: 'parentPhone', label: 'Parent Phone' },
        { key: 'pendingAmount', label: 'Overdue Amount (INR)' },
        { key: 'overdueDays', label: 'Overdue Days' },
        { key: 'installmentDueDate', label: 'Oldest Due Date' },
      ]);
    }

    await this.eventBus.publish(
      createReportGeneratedEvent(
        { coachingId, reportType: 'FEE_COLLECTION_REPORT', format: filter.format || 'json' },
        correlationId,
        userId,
      ),
    );

    return { data: reportDto, csv };
  }

  public async generateAttendanceReport(
    coachingId: string,
    filter: ReportFilterDto = {},
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<{ data: AttendanceReportResponseDto; csv?: string }> {
    const threshold = filter.threshold ?? 75;
    const { sessions, records } = await this.reportRepository.getAttendanceData(
      coachingId,
      filter.batchId,
      { startDate: filter.startDate, endDate: filter.endDate },
    );
    const batchName = filter.batchId ? sessions[0]?.batch?.name : undefined;

    const byStudent = new Map<string, { student: any; attended: number; total: number }>();
    for (const rec of records) {
      // An excused absence neither counts for nor against the student
      if (rec.status === 'EXCUSED') continue;
      const current = byStudent.get(rec.studentId) ?? { student: rec.student, attended: 0, total: 0 };
      current.total += 1;
      if (rec.status === 'PRESENT' || rec.status === 'LATE') current.attended += 1;
      byStudent.set(rec.studentId, current);
    }

    const students: StudentAttendanceItem[] = [...byStudent.entries()]
      .map(([id, data]) => ({
        studentId: id,
        studentName: `${data.student?.firstName ?? 'Student'} ${data.student?.lastName ?? ''}`.trim(),
        ...(batchName ? { batchName } : {}),
        totalClasses: data.total,
        attendedClasses: data.attended,
        percentage: Number(((data.attended / data.total) * 100).toFixed(2)),
      }))
      // Lowest attendance first: those are the students to follow up with
      .sort((a, b) => a.percentage - b.percentage || a.studentName.localeCompare(b.studentName));
    const defaulters = students.filter((student) => student.percentage < threshold);

    const average =
      students.length > 0
        ? Number((students.reduce((acc, s) => acc + s.percentage, 0) / students.length).toFixed(2))
        : null;

    const reportDto: AttendanceReportResponseDto = {
      totalSessions: sessions.length,
      threshold,
      averageAttendancePercentage: average,
      defaultersCount: defaulters.length,
      students,
      defaulters,
    };

    let csv: string | undefined;
    if (filter.format === 'csv') {
      csv = ReportMapper.toCsv(students as any, [
        { key: 'studentName', label: 'Student Name' },
        { key: 'totalClasses', label: 'Total Classes' },
        { key: 'attendedClasses', label: 'Classes Attended' },
        { key: 'percentage', label: 'Attendance (%)' },
      ]);
    }

    await this.eventBus.publish(
      createReportGeneratedEvent(
        { coachingId, reportType: 'ATTENDANCE_REPORT', format: filter.format || 'json' },
        correlationId,
        userId,
      ),
    );

    return { data: reportDto, csv };
  }

  public async generateProfitLossReport(
    coachingId: string,
    filter: ReportFilterDto = {},
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<{ data: ProfitLossResponseDto; csv?: string }> {
    const { feeRevenue, salaryExpenses, generalExpenses } = await this.reportRepository.getPnLData(
      coachingId,
      { startDate: filter.startDate, endDate: filter.endDate },
    );

    const totalExpenses = salaryExpenses.plus(generalExpenses);
    const netProfit = feeRevenue.minus(totalExpenses);
    const reportDto: ProfitLossResponseDto = {
      totalRevenue: toRupees(feeRevenue),
      teacherSalaryExpenses: toRupees(salaryExpenses),
      generalExpenses: toRupees(generalExpenses),
      totalExpenses: toRupees(totalExpenses),
      netProfit: toRupees(netProfit),
      profitMarginPercentage: percentOf(netProfit, feeRevenue),
    };

    let csv: string | undefined;
    if (filter.format === 'csv') {
      csv = ReportMapper.toCsv(
        [
          { metric: 'Total Fee Revenue', amount: reportDto.totalRevenue },
          { metric: 'Teacher Salary Expenses', amount: reportDto.teacherSalaryExpenses },
          { metric: 'General Expenses', amount: reportDto.generalExpenses },
          { metric: 'Total Expenses', amount: reportDto.totalExpenses },
          { metric: 'Net Profit', amount: reportDto.netProfit },
          { metric: 'Profit Margin (%)', amount: reportDto.profitMarginPercentage ?? '' },
        ],
        [
          { key: 'metric', label: 'Financial Metric' },
          { key: 'amount', label: 'Amount (INR)' },
        ],
      );
    }

    await this.eventBus.publish(
      createReportGeneratedEvent(
        { coachingId, reportType: 'PNL_REPORT', format: filter.format || 'json' },
        correlationId,
        userId,
      ),
    );

    return { data: reportDto, csv };
  }
}
