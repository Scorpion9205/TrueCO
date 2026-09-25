import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '@/lib/api';
import { __resetSessionForTests } from '@/lib/auth/session';
import { toCsv } from '@/lib/csv';
import { todayInIndia } from '@/lib/dates';
import {
  type AttendanceReport,
  type FeeReport,
  periodRange,
  type ProfitLossReport,
  rangeLabel,
} from '@/lib/reports';
import { renderWithIntl } from '@/test/render';
import { OWNER, signInAs } from '@/test/session';
import { ReportsPage } from './reports-page';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => __resetSessionForTests());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const feeReport: FeeReport = {
  totalExpected: 100000,
  totalCollected: 60000,
  totalWaived: 10000,
  totalPending: 30000,
  totalOverdue: 12500.5,
  collectionPercentage: 66.67,
  defaulterCount: 1,
  defaulters: [
    {
      studentId: 's1',
      studentName: 'Rahul Sharma',
      studentPhone: '9876500001',
      parentName: 'Suresh Sharma',
      parentPhone: '9876500002',
      pendingAmount: 12500.5,
      overdueDays: 12,
      installmentDueDate: '2026-09-13',
    },
  ],
};

const attendance: AttendanceReport = {
  totalSessions: 20,
  threshold: 75,
  averageAttendancePercentage: 71.5,
  defaultersCount: 1,
  students: [
    {
      studentId: 's2',
      studentName: 'Rohan Das',
      totalClasses: 20,
      attendedClasses: 10,
      percentage: 50,
    },
    {
      studentId: 's1',
      studentName: 'Aman Rao',
      totalClasses: 20,
      attendedClasses: 19,
      percentage: 95,
    },
  ],
  defaulters: [
    {
      studentId: 's2',
      studentName: 'Rohan Das',
      totalClasses: 20,
      attendedClasses: 10,
      percentage: 50,
    },
  ],
};

const pnl: ProfitLossReport = {
  totalRevenue: 100000,
  teacherSalaryExpenses: 50000,
  generalExpenses: 70000,
  totalExpenses: 120000,
  netProfit: -20000,
  profitMarginPercentage: -20,
};

function reportsApi() {
  const requests: Record<string, URLSearchParams[]> = { attendance: [], pnl: [] };
  server.use(
    http.get(`${API_URL}/reports/fees`, () => HttpResponse.json({ data: feeReport })),
    http.get(`${API_URL}/reports/attendance`, ({ request }) => {
      requests.attendance!.push(new URL(request.url).searchParams);
      return HttpResponse.json({ data: attendance });
    }),
    http.get(`${API_URL}/reports/pnl`, ({ request }) => {
      requests.pnl!.push(new URL(request.url).searchParams);
      return HttpResponse.json({ data: pnl });
    }),
    http.get(`${API_URL}/batches`, () =>
      HttpResponse.json({
        data: [
          {
            id: 'b1',
            name: 'Class 10',
            academicYear: '2026-27',
            daysOfWeek: [],
            isActive: true,
            createdAt: '2026-04-01T00:00:00.000Z',
          },
        ],
      }),
    ),
  );
  return requests;
}

describe('ReportsPage', () => {
  it('shows the fee report with waived fees apart from what is still owed', async () => {
    reportsApi();
    signInAs(OWNER);
    renderWithIntl(<ReportsPage />);

    expect(await screen.findByText('₹60,000')).toBeInTheDocument();
    expect(screen.getByText('66.67% of fees due')).toBeInTheDocument();
    expect(screen.getByText('₹30,000')).toBeInTheDocument();
    expect(screen.getByText('₹12,500.50 overdue')).toBeInTheDocument();
    expect(screen.getByText('₹10,000')).toBeInTheDocument();
    expect(screen.getByText('1 student with overdue fees')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rahul Sharma' })).toHaveAttribute(
      'href',
      '/app/students/s1',
    );
    expect(screen.getByRole('link', { name: '9876500002' })).toHaveAttribute(
      'href',
      'tel:9876500002',
    );
    expect(screen.getByText(/12 days/)).toBeInTheDocument();
  });

  it('downloads the defaulters as CSV', async () => {
    reportsApi();
    const createObjectURL = vi.fn(() => 'blob:report');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    signInAs(OWNER);
    renderWithIntl(<ReportsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Download CSV' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('shows attendance for this month, lowest first, and filters by batch and threshold', async () => {
    const requests = reportsApi();
    signInAs(OWNER);
    renderWithIntl(<ReportsPage />);

    await userEvent.click(await screen.findByRole('tab', { name: 'Attendance' }));
    expect(await screen.findByText('71.5%')).toBeInTheDocument();
    const names = screen.getAllByRole('link').map((link) => link.textContent);
    expect(names).toEqual(['Rohan Das', 'Aman Rao']);

    const today = todayInIndia();
    expect(requests.attendance![0]!.get('startDate')).toBe(`${today.slice(0, 7)}-01`);
    expect(requests.attendance![0]!.get('endDate')).toBe(today);
    expect(requests.attendance![0]!.get('threshold')).toBe('75');

    await userEvent.selectOptions(screen.getByLabelText('Batch'), 'b1');
    await userEvent.selectOptions(screen.getByLabelText('Flag students'), '85');
    await waitFor(() => {
      const last = requests.attendance!.at(-1)!;
      expect(last.get('batchId')).toBe('b1');
      expect(last.get('threshold')).toBe('85');
    });

    await userEvent.click(screen.getByLabelText(/Only students below/));
    expect(screen.queryByRole('link', { name: 'Aman Rao' })).toBeNull();
  });

  it('shows a loss for last month', async () => {
    const requests = reportsApi();
    signInAs(OWNER);
    renderWithIntl(<ReportsPage />);

    await userEvent.click(await screen.findByRole('tab', { name: 'Profit & loss' }));
    await screen.findByText('₹20,000');
    // On the card and in the breakdown legend
    expect(screen.getAllByText('Loss')).toHaveLength(2);
    expect(screen.getByText('-20% of fees collected')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Period'), 'lastMonth');
    const [from, to] = periodRange('lastMonth', todayInIndia());
    await waitFor(() => {
      const last = requests.pnl!.at(-1)!;
      expect(last.get('startDate')).toBe(from);
      expect(last.get('endDate')).toBe(to);
    });
  });

  it('lets a custom range be picked', async () => {
    const requests = reportsApi();
    signInAs(OWNER);
    renderWithIntl(<ReportsPage />);

    await userEvent.click(await screen.findByRole('tab', { name: 'Profit & loss' }));
    await userEvent.selectOptions(await screen.findByLabelText('Period'), 'custom');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-04-01' } });
    await waitFor(() => expect(requests.pnl!.at(-1)!.get('startDate')).toBe('2026-04-01'));
    expect(within(screen.getByRole('tabpanel')).getByLabelText('To')).toHaveValue(todayInIndia());
  });
});

describe('report periods', () => {
  it('uses the Indian financial year (April to March)', () => {
    expect(periodRange('thisYear', '2026-09-25')).toEqual(['2026-04-01', '2026-09-25']);
    expect(periodRange('thisYear', '2027-02-10')).toEqual(['2026-04-01', '2027-02-10']);
    expect(periodRange('lastYear', '2026-09-25')).toEqual(['2025-04-01', '2026-03-31']);
  });

  it('covers whole months, and never runs past today', () => {
    expect(periodRange('thisMonth', '2026-09-25')).toEqual(['2026-09-01', '2026-09-25']);
    expect(periodRange('lastMonth', '2026-03-10')).toEqual(['2026-02-01', '2026-02-28']);
    expect(periodRange('custom', '2026-09-25', { from: '2026-09-10', to: '2027-01-01' })).toEqual([
      '2026-09-10',
      '2026-09-25',
    ]);
    // Swapped ends are put in order
    expect(periodRange('custom', '2026-09-25', { from: '2026-09-20', to: '2026-09-01' })).toEqual([
      '2026-09-01',
      '2026-09-20',
    ]);
  });

  it('labels ranges', () => {
    expect(rangeLabel(['2026-04-01', '2026-09-25'])).toBe('1 Apr 2026 – 25 Sept 2026');
  });
});

describe('toCsv', () => {
  it('quotes values and stops formulas', () => {
    const csv = toCsv(
      [{ name: '=cmd|"/c calc"!A1', amount: -5 }],
      [
        { label: 'Name', value: (row) => row.name },
        { label: 'Amount', value: (row) => row.amount },
      ],
    );
    expect(csv).toBe('"Name","Amount"\r\n"\'=cmd|""/c calc""!A1","-5"');
  });
});
