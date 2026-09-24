export interface OwnerKpiMetrics {
  readonly totalStudents: number;
  readonly totalTeachers: number;
  readonly totalBatches: number;
  readonly monthlyRevenue: number;
  readonly monthlyPendingFees: number;
  readonly monthlyExpenses: number;
  /** Percentage present of today's marked attendance; null until any is marked */
  readonly todayAttendanceRate: number | null;
  readonly highRiskCount: number;
}

export interface RecentActivityItem {
  readonly id: string;
  readonly studentName?: string;
  readonly eventType: string;
  readonly summary: string;
  readonly occurredAt: Date;
}

export interface UpcomingInstallmentItem {
  readonly installmentId: string;
  readonly studentName: string;
  readonly amount: number;
  readonly dueDate: Date;
}

export interface OwnerDashboardResponseDto {
  readonly metrics: OwnerKpiMetrics;
  readonly recentActivities: RecentActivityItem[];
  readonly upcomingInstallments: UpcomingInstallmentItem[];
}

export interface TeacherBatchSummary {
  readonly batchId: string;
  readonly batchName: string;
  readonly subject?: string;
  readonly studentCount: number;
}

export interface TeacherSessionSummary {
  readonly sessionId: string;
  readonly batchName: string;
  readonly sessionDate: Date;
  readonly presentCount: number;
  readonly totalCount: number;
}

export interface TeacherDashboardResponseDto {
  readonly assignedBatches: TeacherBatchSummary[];
  readonly todaySessions: TeacherSessionSummary[];
  readonly activeHomeworkCount: number;
}
