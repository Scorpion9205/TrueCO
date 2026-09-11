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
    const { plans, installments, transactions } = await this.reportRepository.getFeeData(coachingId);

    const totalExpected = plans.reduce((acc, p) => acc + Number(p.finalAmount), 0);
    const totalCollected = transactions.reduce((acc, t) => acc + Number(t.amount), 0);
    const totalPending = Math.max(0, totalExpected - totalCollected);
    const collectionPercentage =
      totalExpected > 0 ? Number(((totalCollected / totalExpected) * 100).toFixed(2)) : 100;

    const now = new Date();
    const defaultersMap = new Map<string, DefaulterItem>();

    for (const inst of installments) {
      const isUnpaid =
        inst.status === FeeInstallmentStatus.PENDING ||
        inst.status === FeeInstallmentStatus.PARTIAL ||
        inst.status === FeeInstallmentStatus.OVERDUE;

      const dueDate = new Date(inst.dueDate);
      if (isUnpaid && dueDate < now) {
        const student = inst.feePlan?.student;
        if (!student) continue;

        const unpaidBalance = Number(inst.amount) - Number(inst.paidAmount || 0);
        const overdueDays = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const parent = student.studentParents?.[0]?.parent;

        const existing = defaultersMap.get(student.id);
        if (existing) {
          defaultersMap.set(student.id, {
            ...existing,
            pendingAmount: existing.pendingAmount + unpaidBalance,
            overdueDays: Math.max(existing.overdueDays, overdueDays),
          });
        } else {
          defaultersMap.set(student.id, {
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`.trim(),
            studentPhone: student.phone,
            parentName: parent ? `${parent.firstName} ${parent.lastName}`.trim() : undefined,
            parentPhone: parent?.phone,
            pendingAmount: unpaidBalance,
            overdueDays,
            installmentDueDate: dueDate,
          });
        }
      }
    }

    const defaulters = Array.from(defaultersMap.values()).sort((a, b) => b.pendingAmount - a.pendingAmount);

    const reportDto: FeeReportResponseDto = {
      totalExpected,
      totalCollected,
      totalPending,
      collectionPercentage,
      defaulterCount: defaulters.length,
      defaulters,
    };

    let csv: string | undefined;
    if (filter.format === 'csv') {
      csv = ReportMapper.toCsv(defaulters as any, [
        { key: 'studentName', label: 'Student Name' },
        { key: 'studentPhone', label: 'Phone' },
        { key: 'parentName', label: 'Parent Name' },
        { key: 'parentPhone', label: 'Parent Phone' },
        { key: 'pendingAmount', label: 'Pending Amount (INR)' },
        { key: 'overdueDays', label: 'Overdue Days' },
        { key: 'installmentDueDate', label: 'Due Date' },
      ]);
    }

    await this.eventBus.publish(
      createReportGeneratedEvent(
        {
          coachingId,
          reportType: 'FEE_COLLECTION_REPORT',
          format: filter.format || 'json',
        },
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
    const startDate = filter.startDate ? new Date(filter.startDate) : undefined;
    const endDate = filter.endDate ? new Date(filter.endDate) : undefined;
    const threshold = filter.threshold ?? 75;

    const { sessions, records } = await this.reportRepository.getAttendanceData(
      coachingId,
      filter.batchId,
      startDate,
      endDate,
    );

    const studentMap = new Map<
      string,
      { student: any; attended: number; total: number }
    >();

    for (const rec of records) {
      const sId = rec.studentId;
      const current = studentMap.get(sId) || {
        student: rec.student,
        attended: 0,
        total: 0,
      };

      current.total++;
      if (rec.status === 'PRESENT' || rec.status === 'LATE') {
        current.attended++;
      }
      studentMap.set(sId, current);
    }

    const students: StudentAttendanceItem[] = [];
    const defaulters: StudentAttendanceItem[] = [];
    let cumulativePercentage = 0;

    for (const [id, data] of studentMap.entries()) {
      const percentage = data.total > 0 ? Number(((data.attended / data.total) * 100).toFixed(2)) : 100;
      cumulativePercentage += percentage;

      const item: StudentAttendanceItem = {
        studentId: id,
        studentName: `${data.student?.firstName || 'Student'} ${data.student?.lastName || ''}`.trim(),
        totalClasses: data.total,
        attendedClasses: data.attended,
        percentage,
      };

      students.push(item);
      if (percentage < threshold) {
        defaulters.push(item);
      }
    }

    const averageAttendancePercentage =
      students.length > 0 ? Number((cumulativePercentage / students.length).toFixed(2)) : 100;

    const reportDto: AttendanceReportResponseDto = {
      totalSessions: sessions.length,
      averageAttendancePercentage,
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
        {
          coachingId,
          reportType: 'ATTENDANCE_REPORT',
          format: filter.format || 'json',
        },
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
    const startDate = filter.startDate ? new Date(filter.startDate) : undefined;
    const endDate = filter.endDate ? new Date(filter.endDate) : undefined;

    const { feeRevenue, salaryExpenses, generalExpenses } =
      await this.reportRepository.getPnLData(coachingId, startDate, endDate);

    const totalExpenses = salaryExpenses + generalExpenses;
    const netProfit = feeRevenue - totalExpenses;
    const profitMarginPercentage =
      feeRevenue > 0 ? Number(((netProfit / feeRevenue) * 100).toFixed(2)) : 0;

    const reportDto: ProfitLossResponseDto = {
      totalRevenue: feeRevenue,
      teacherSalaryExpenses: salaryExpenses,
      generalExpenses,
      totalExpenses,
      netProfit,
      profitMarginPercentage,
    };

    let csv: string | undefined;
    if (filter.format === 'csv') {
      csv = ReportMapper.toCsv(
        [
          { metric: 'Total Fee Revenue', amount: feeRevenue },
          { metric: 'Teacher Salary Expenses', amount: salaryExpenses },
          { metric: 'General Expenses', amount: generalExpenses },
          { metric: 'Total Expenses', amount: totalExpenses },
          { metric: 'Net Profit', amount: netProfit },
          { metric: 'Profit Margin (%)', amount: profitMarginPercentage },
        ],
        [
          { key: 'metric', label: 'Financial Metric' },
          { key: 'amount', label: 'Amount (INR)' },
        ],
      );
    }

    await this.eventBus.publish(
      createReportGeneratedEvent(
        {
          coachingId,
          reportType: 'PNL_REPORT',
          format: filter.format || 'json',
        },
        correlationId,
        userId,
      ),
    );

    return { data: reportDto, csv };
  }
}
