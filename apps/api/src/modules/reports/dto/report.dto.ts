export interface DefaulterItem {
  readonly studentId: string;
  readonly studentName: string;
  readonly studentPhone: string;
  readonly parentName?: string;
  readonly parentPhone?: string;
  /** Overdue balance: unpaid instalments whose due date has passed */
  readonly pendingAmount: number;
  /** Days since the oldest overdue instalment was due */
  readonly overdueDays: number;
  /** The oldest overdue due date (YYYY-MM-DD) */
  readonly installmentDueDate: string;
}

export interface FeeReportResponseDto {
  /** Final amounts of all fee plans */
  readonly totalExpected: number;
  readonly totalCollected: number;
  /** Written off; neither collected nor still owed */
  readonly totalWaived: number;
  /** Still owed, whether due yet or not */
  readonly totalPending: number;
  /** The part of totalPending that is past its due date */
  readonly totalOverdue: number;
  /** Collected as a share of what is collectable (expected minus waived); null when nothing is */
  readonly collectionPercentage: number | null;
  readonly defaulterCount: number;
  readonly defaulters: DefaulterItem[];
}

export interface StudentAttendanceItem {
  readonly studentId: string;
  readonly studentName: string;
  readonly batchName?: string;
  readonly totalClasses: number;
  readonly attendedClasses: number;
  readonly percentage: number;
}

export interface AttendanceReportResponseDto {
  readonly totalSessions: number;
  /** Students below this percentage are listed as defaulters */
  readonly threshold: number;
  /** null when no attendance was marked in the range */
  readonly averageAttendancePercentage: number | null;
  readonly defaultersCount: number;
  readonly students: StudentAttendanceItem[];
  readonly defaulters: StudentAttendanceItem[];
}

export interface ProfitLossResponseDto {
  readonly totalRevenue: number;
  readonly teacherSalaryExpenses: number;
  readonly generalExpenses: number;
  readonly totalExpenses: number;
  readonly netProfit: number;
  /** null when there was no revenue to measure against */
  readonly profitMarginPercentage: number | null;
}

export interface ReportFilterDto {
  readonly startDate?: string;
  readonly endDate?: string;
  readonly batchId?: string;
  readonly format?: 'json' | 'csv';
  readonly threshold?: number;
}
