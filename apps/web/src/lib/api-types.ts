// Response shapes of the API endpoints the web app reads. Dates arrive as ISO strings.

export type SubscriptionStatus =
  'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'GRACE' | 'EXPIRED' | 'CANCELLED';

/** GET /coachings/me (apps/api CoachingResponseDto) */
export interface CoachingProfile {
  id: string;
  name: string;
  code: string;
  phone: string;
  email: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  logoUrl?: string | null;
  timezone: string;
  currency: string;
  subscription: {
    status: SubscriptionStatus;
    trialEndsAt: string;
    daysRemaining: number;
    features: string[];
  };
}

/** GET /dashboard/owner (apps/api OwnerDashboardResponseDto); money in rupees */
export interface OwnerDashboard {
  metrics: {
    totalStudents: number;
    totalTeachers: number;
    totalBatches: number;
    monthlyRevenue: number;
    monthlyPendingFees: number;
    monthlyExpenses: number;
    /** Percentage 0-100 of today's attendance records marked present; null until any is marked */
    todayAttendanceRate: number | null;
    highRiskCount: number;
  };
  recentActivities: Array<{
    id: string;
    studentName?: string;
    eventType: string;
    summary: string;
    occurredAt: string;
  }>;
  upcomingInstallments: Array<{
    installmentId: string;
    studentName: string;
    amount: number;
    dueDate: string;
  }>;
}

/** GET /dashboard/teacher (apps/api TeacherDashboardResponseDto) */
export interface TeacherDashboard {
  assignedBatches: Array<{
    batchId: string;
    batchName: string;
    subject?: string;
    studentCount: number;
  }>;
  todaySessions: Array<{
    sessionId: string;
    batchName: string;
    sessionDate: string;
    presentCount: number;
    totalCount: number;
  }>;
  activeHomeworkCount: number;
}
