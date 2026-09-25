import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '@/lib/api';
import type { Batch, Student } from '@/lib/academics';
import {
  addDays,
  type AttendanceSession,
  monthRange,
  shiftMonth,
  summariseByStudent,
  toDay,
} from '@/lib/attendance';
import { __resetSessionForTests } from '@/lib/auth/session';
import { todayInIndia } from '@/lib/dates';
import { renderWithIntl } from '@/test/render';
import { OWNER, signInAs, TEACHER } from '@/test/session';
import { AttendancePage } from './attendance-page';
import { buildRoster, initialMarks } from './mark-sheet';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => __resetSessionForTests());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const batch: Batch = {
  id: 'b1',
  name: 'Class 10 Morning',
  subject: 'Physics',
  academicYear: '2026-27',
  daysOfWeek: [],
  isActive: true,
  createdAt: '2026-06-01T00:00:00.000Z',
};
const student = (id: string, firstName: string): Student => ({
  id,
  firstName,
  lastName: 'Sharma',
  joiningDate: '2026-06-01T00:00:00.000Z',
  isActive: true,
  createdAt: '2026-06-01T00:00:00.000Z',
});
const roster = [student('s1', 'Aarav'), student('s2', 'Diya'), student('s3', 'Kabir')];

function session(day: string, statuses: Record<string, AttendanceSession['records'][0]['status']>) {
  const records = Object.entries(statuses).map(([studentId, status]) => ({
    id: `r-${studentId}`,
    studentId,
    studentName: `${roster.find((s) => s.id === studentId)?.firstName ?? 'Old'} Sharma`,
    status,
  }));
  return {
    id: `session-${day}`,
    batchId: 'b1',
    sessionDate: `${day}T00:00:00.000Z`,
    totalStudents: records.length,
    presentCount: records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length,
    absentCount: records.filter((r) => r.status === 'ABSENT').length,
    records,
  } satisfies AttendanceSession;
}

function api({ sessions = [] as AttendanceSession[], batches = [batch] } = {}) {
  const requests: Array<{ startDate: string | null; endDate: string | null }> = [];
  server.use(
    http.get(`${API_URL}/batches`, () => HttpResponse.json({ data: batches })),
    http.get(`${API_URL}/batches/b1/students`, () => HttpResponse.json({ data: roster })),
    http.get(`${API_URL}/attendance/batches/b1`, ({ request }) => {
      const url = new URL(request.url);
      requests.push({
        startDate: url.searchParams.get('startDate'),
        endDate: url.searchParams.get('endDate'),
      });
      return HttpResponse.json({ data: sessions });
    }),
  );
  return requests;
}

const row = (name: string) => screen.getByRole('group', { name: `Attendance for ${name}` });

describe('marking attendance', () => {
  it('starts everyone present and saves the day with the changes', async () => {
    const requests = api();
    let body: unknown;
    server.use(
      http.post(`${API_URL}/attendance`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: session(todayInIndia(), {}) });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<AttendancePage />);

    // The only batch is picked automatically, and today's register is loaded
    await screen.findByRole('group', { name: 'Attendance for Aarav Sharma' });
    expect(requests[0]).toEqual({ startDate: todayInIndia(), endDate: todayInIndia() });
    expect(screen.getByText('Not marked yet')).toBeInTheDocument();
    expect(within(row('Diya Sharma')).getByRole('button', { name: 'Present' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(within(row('Diya Sharma')).getByRole('button', { name: 'Absent' }));
    await userEvent.click(within(row('Kabir Sharma')).getByRole('button', { name: 'Late' }));
    expect(screen.getByText('1 present · 1 absent · 1 late · 0 excused')).toBeInTheDocument();
    expect(
      screen.getByText(/Parents of absent students get a WhatsApp message/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }));

    await waitFor(() =>
      expect(body).toEqual({
        batchId: 'b1',
        sessionDate: todayInIndia(),
        records: [
          { studentId: 's1', status: 'PRESENT' },
          { studentId: 's2', status: 'ABSENT' },
          { studentId: 's3', status: 'LATE' },
        ],
      }),
    );
  });

  it('loads a saved day and only enables saving after a change', async () => {
    const day = addDays(todayInIndia(), -2);
    api({ sessions: [session(day, { s1: 'PRESENT', s2: 'ABSENT', s3: 'PRESENT' })] });
    signInAs(OWNER);
    renderWithIntl(<AttendancePage />, { searchParams: `?batch=b1&date=${day}` });

    await screen.findByText('Marked');
    expect(within(row('Diya Sharma')).getByRole('button', { name: 'Absent' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const update = screen.getByRole('button', { name: 'Update attendance' });
    expect(update).toBeDisabled();

    await userEvent.click(within(row('Diya Sharma')).getByRole('button', { name: 'Present' }));
    expect(update).toBeEnabled();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('marks everyone present in one tap', async () => {
    const day = addDays(todayInIndia(), -1);
    api({ sessions: [session(day, { s1: 'ABSENT', s2: 'ABSENT', s3: 'LATE' })] });
    signInAs(OWNER);
    renderWithIntl(<AttendancePage />, { searchParams: `?batch=b1&date=${day}` });

    await userEvent.click(await screen.findByRole('button', { name: 'Mark all present' }));
    expect(screen.getByText('3 present · 0 absent · 0 late · 0 excused')).toBeInTheDocument();
  });

  it('keeps a student who has since left the batch in that day’s register', async () => {
    const day = addDays(todayInIndia(), -3);
    api({ sessions: [session(day, { s1: 'PRESENT', gone: 'ABSENT' })] });
    signInAs(OWNER);
    renderWithIntl(<AttendancePage />, { searchParams: `?batch=b1&date=${day}` });

    expect(await screen.findByText('No longer in this batch')).toBeInTheDocument();
  });

  it('never opens a future date', async () => {
    const requests = api();
    signInAs(OWNER);
    renderWithIntl(<AttendancePage />, {
      searchParams: `?batch=b1&date=${addDays(todayInIndia(), 5)}`,
    });

    await screen.findByRole('group', { name: 'Attendance for Aarav Sharma' });
    expect(requests[0]?.startDate).toBe(todayInIndia());
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled();
  });

  it('asks which batch when there are several', async () => {
    api({ batches: [batch, { ...batch, id: 'b2', name: 'Class 12 Evening' }] });
    signInAs(OWNER);
    renderWithIntl(<AttendancePage />);

    expect(await screen.findByText('Choose a batch to take attendance.')).toBeInTheDocument();
  });

  it('gives teachers their own batches and explains when they have none', async () => {
    server.use(
      http.get(`${API_URL}/dashboard/teacher`, () =>
        HttpResponse.json({
          data: { assignedBatches: [], todaySessions: [], activeHomeworkCount: 0 },
        }),
      ),
    );
    signInAs(TEACHER);
    renderWithIntl(<AttendancePage />);

    expect(await screen.findByText(/haven't been assigned to a batch/)).toBeInTheDocument();
  });
});

describe('history', () => {
  it('shows the month by day and by student, flagging low attendance', async () => {
    const month = todayInIndia().slice(0, 7);
    const [from, to] = monthRange(month);
    const requests = api({
      sessions: [
        session(`${month}-02`, { s1: 'PRESENT', s2: 'ABSENT', s3: 'PRESENT' }),
        session(`${month}-01`, { s1: 'PRESENT', s2: 'ABSENT', s3: 'LATE' }),
      ],
    });
    const onUrlUpdate = vi.fn();
    signInAs(OWNER);
    renderWithIntl(<AttendancePage />, { searchParams: '?view=history&batch=b1', onUrlUpdate });

    expect(await screen.findByText('Average attendance: 67%')).toBeInTheDocument();
    expect(requests[0]).toEqual({ startDate: from, endDate: to });
    expect(screen.getAllByText('2 of 3 present')).toHaveLength(2);
    // Lowest first, flagged below 75%
    expect(screen.getByLabelText('Below 75%')).toBeInTheDocument();
    expect(screen.getByText('0 of 2 classes')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: /^Open / })[0]!);
    await waitFor(() =>
      expect(onUrlUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({ queryString: expect.stringContaining(`date=${month}-02`) }),
      ),
    );
  });
});

describe('attendance helpers', () => {
  it('reads API dates as Indian calendar days', () => {
    expect(toDay('2026-09-24T18:30:00.000Z')).toBe('2026-09-25');
    expect(toDay('2026-09-25T00:00:00.000Z')).toBe('2026-09-25');
  });

  it('moves between days and months across boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(monthRange('2028-02')).toEqual(['2028-02-01', '2028-02-29']);
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('summarises students with late counting as attended', () => {
    const rows = summariseByStudent([
      session('2026-09-01', { s1: 'PRESENT', s2: 'ABSENT', s3: 'LATE' }),
      session('2026-09-02', { s1: 'PRESENT', s2: 'EXCUSED', s3: 'ABSENT' }),
    ]);
    expect(rows.map((r) => [r.studentName, r.attended, r.marked, r.percent])).toEqual([
      ['Diya Sharma', 0, 2, 0],
      ['Kabir Sharma', 1, 2, 50],
      ['Aarav Sharma', 2, 2, 100],
    ]);
  });

  it('defaults unmarked students to present and keeps saved marks', () => {
    const saved = session('2026-09-01', { s2: 'ABSENT' });
    const entries = buildRoster(roster, saved);
    expect(initialMarks(entries, saved)).toEqual({ s1: 'PRESENT', s2: 'ABSENT', s3: 'PRESENT' });
  });
});
