import { screen, within } from '@testing-library/react';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API_URL } from '@/lib/api';
import type { OwnerDashboard, TeacherDashboard } from '@/lib/api-types';
import { __resetSessionForTests } from '@/lib/auth/session';
import { renderWithIntl } from '@/test/render';
import { OWNER, signInAs, TEACHER } from '@/test/session';
import { DashboardHome } from './dashboard-home';
import { firstName, greetingKey } from './greeting';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => __resetSessionForTests());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ownerData: OwnerDashboard = {
  metrics: {
    totalStudents: 124,
    totalTeachers: 6,
    totalBatches: 8,
    monthlyRevenue: 184500,
    monthlyPendingFees: 21000.5,
    monthlyExpenses: 45000,
    todayAttendanceRate: 91.67,
    highRiskCount: 3,
  },
  recentActivities: [
    {
      id: 'a1',
      studentName: 'Aarav',
      eventType: 'FEE_PAID',
      summary: 'Paid ₹5,000 towards March fees',
      occurredAt: '2026-09-24T05:30:00.000Z',
    },
  ],
  upcomingInstallments: [
    { installmentId: 'i1', studentName: 'Diya', amount: 7500, dueDate: '2026-09-30T00:00:00.000Z' },
  ],
};

function respond(path: string, body: JsonBodyType, status = 200) {
  server.use(
    http.get(`${API_URL}${path}`, () =>
      HttpResponse.json(status < 400 ? { data: body } : body, { status }),
    ),
  );
}

const kpi = (label: string) => screen.getByText(label).closest('div')!.parentElement!;

describe('owner dashboard', () => {
  it('shows the key figures formatted for India', async () => {
    signInAs(OWNER);
    respond('/dashboard/owner', ownerData);
    renderWithIntl(<DashboardHome />);

    expect(await screen.findByText('₹1,84,500')).toBeInTheDocument();
    expect(within(kpi('Students')).getByText('124')).toBeInTheDocument();
    expect(within(kpi('Attendance today')).getByText('92%')).toBeInTheDocument();
    expect(within(kpi('Fees pending')).getByText('₹21,000.50')).toBeInTheDocument();
    expect(within(kpi('Students at risk')).getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Diya')).toBeInTheDocument();
    expect(screen.getByText('Due 30 Sept 2026')).toBeInTheDocument();
    expect(screen.getByText('Paid ₹5,000 towards March fees')).toBeInTheDocument();
    expect(screen.queryByText("Let's set up your institute")).toBeNull();
  });

  it('greets a brand-new institute with setup steps and friendly empty lists', async () => {
    signInAs(OWNER);
    respond('/dashboard/owner', {
      metrics: {
        ...ownerData.metrics,
        totalStudents: 0,
        totalBatches: 0,
        totalTeachers: 0,
        highRiskCount: 0,
        todayAttendanceRate: null,
      },
      recentActivities: [],
      upcomingInstallments: [],
    });
    renderWithIntl(<DashboardHome />);

    expect(await screen.findByText("Let's set up your institute")).toBeInTheDocument();
    expect(within(kpi('Attendance today')).getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Not marked yet today')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Create your batches/ })).toHaveAttribute(
      'href',
      '/app/batches',
    );
    expect(screen.getByText('No fee dues coming up.')).toBeInTheDocument();
  });

  it('points owners to billing when the subscription has lapsed', async () => {
    signInAs(OWNER);
    respond(
      '/dashboard/owner',
      { error: { code: 'TRIAL_EXPIRED', message: 'Trial ended', upgradeUrl: '/billing/upgrade' } },
      402,
    );
    renderWithIntl(<DashboardHome />);

    expect(await screen.findByText('Subscription needed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose a plan' })).toHaveAttribute(
      'href',
      '/app/billing',
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('offers a retry when loading fails', async () => {
    signInAs(OWNER);
    respond('/dashboard/owner', { error: { code: 'INTERNAL_ERROR' } }, 500);
    renderWithIntl(<DashboardHome />);

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this");
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('teacher dashboard', () => {
  it("shows a teacher their batches and today's attendance, never the owner's figures", async () => {
    const teacherData: TeacherDashboard = {
      assignedBatches: [
        { batchId: 'b1', batchName: 'Class 10 Morning', subject: 'Physics', studentCount: 32 },
        { batchId: 'b2', batchName: 'Class 12 Evening', studentCount: 18 },
      ],
      todaySessions: [
        {
          sessionId: 's1',
          batchName: 'Class 10 Morning',
          sessionDate: '2026-09-24T00:00:00.000Z',
          presentCount: 30,
          totalCount: 32,
        },
      ],
      activeHomeworkCount: 4,
    };
    signInAs(TEACHER);
    respond('/dashboard/teacher', teacherData);
    renderWithIntl(<DashboardHome />);

    expect(await screen.findByText('30/32 present')).toBeInTheDocument();
    expect(screen.getByText('My batches · 50 students')).toBeInTheDocument();
    expect(screen.getByText('Physics · 32 students')).toBeInTheDocument();
    expect(within(kpi('Active homework')).getByText('4')).toBeInTheDocument();
    expect(screen.queryByText('Collected this month')).toBeNull();
  });
});

describe('greeting', () => {
  it.each([
    ['2026-09-24T02:00:00.000Z', 'morning'], // 07:30 IST
    ['2026-09-24T08:00:00.000Z', 'afternoon'], // 13:30 IST
    ['2026-09-24T13:00:00.000Z', 'evening'], // 18:30 IST
  ])('%s is %s in India', (iso, expected) => {
    expect(greetingKey(new Date(iso))).toBe(expected);
  });

  it('uses the first name', () => {
    expect(firstName('  Asha Rani Sharma ')).toBe('Asha');
  });
});
