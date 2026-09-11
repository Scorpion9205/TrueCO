import {
  OwnerDashboardResponseDto,
  TeacherDashboardResponseDto,
} from './dto/dashboard.dto.js';

export class DashboardMapper {
  public static toOwnerResponseDto(data: any): OwnerDashboardResponseDto {
    return {
      metrics: data.metrics,
      recentActivities: data.recentActivities.map((a: any) => ({
        id: a.id,
        studentName: a.student ? `${a.student.firstName} ${a.student.lastName}`.trim() : undefined,
        eventType: a.eventType,
        summary: a.summary,
        occurredAt: new Date(a.occurredAt),
      })),
      upcomingInstallments: data.upcomingInstallments.map((i: any) => ({
        installmentId: i.id,
        studentName: i.feePlan?.student
          ? `${i.feePlan.student.firstName} ${i.feePlan.student.lastName}`.trim()
          : 'Student',
        amount: Number(i.amount) - Number(i.paidAmount || 0),
        dueDate: new Date(i.dueDate),
      })),
    };
  }

  public static toTeacherResponseDto(data: any): TeacherDashboardResponseDto {
    return {
      assignedBatches: data.assignedBatches.map((b: any) => ({
        batchId: b.id,
        batchName: b.name,
        subject: b.subject,
        studentCount: b.batchStudents?.length || 0,
      })),
      todaySessions: data.todaySessions.map((s: any) => {
        const records = s.records || [];
        const presentCount = records.filter(
          (r: any) => r.status === 'PRESENT' || r.status === 'LATE',
        ).length;
        return {
          sessionId: s.id,
          batchName: s.batch?.name || 'Batch',
          sessionDate: new Date(s.sessionDate),
          presentCount,
          totalCount: records.length,
        };
      }),
      activeHomeworkCount: data.activeHomeworkCount || 0,
    };
  }
}
