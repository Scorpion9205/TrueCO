export interface DefaulterItem {
  readonly studentId: string;
  readonly studentName: string;
  readonly studentPhone: string;
  readonly parentName?: string;
  readonly parentPhone?: string;
  readonly pendingAmount: number;
  readonly overdueDays: number;
  readonly installmentDueDate: Date;
}

export interface FeeReportResponseDto {
  readonly totalExpected: number;
  readonly totalCollected: number;
  readonly totalPending: number;
  readonly collectionPercentage: number;
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
  readonly averageAttendancePercentage: number;
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
  readonly profitMarginPercentage: number;
}

export interface ReportFilterDto {
  readonly startDate?: string;
  readonly endDate?: string;
  readonly batchId?: string;
  readonly format?: 'json' | 'csv';
  readonly threshold?: number;
}
