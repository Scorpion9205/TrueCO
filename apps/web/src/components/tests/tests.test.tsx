import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentResults } from '@/components/students/student-results';
import { API_URL } from '@/lib/api';
import type { Batch, Student } from '@/lib/academics';
import { hasPassed, type Test } from '@/lib/assessments';
import { __resetSessionForTests } from '@/lib/auth/session';
import { renderWithIntl } from '@/test/render';
import { OWNER, signInAs } from '@/test/session';
import { entriesToSave, parseMark, TestDetail } from './test-detail';
import { TestFormDialog } from './test-form-dialog';
import { TestsPage } from './tests-page';

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  __resetSessionForTests();
  vi.clearAllMocks();
});
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

const test: Test = {
  id: 't1',
  batchId: 'b1',
  title: 'Unit Test 3',
  subject: 'Physics',
  testDate: '2026-09-20T00:00:00.000Z',
  totalMarks: 50,
  passingMarks: 20,
  averageScore: 31.5,
  highestScore: 45,
  results: [
    {
      id: 'r1',
      studentId: 's1',
      studentName: 'Aarav Sharma',
      marksObtained: 45,
      isAbsent: false,
      percentage: 90,
    },
    {
      id: 'r2',
      studentId: 's2',
      studentName: 'Diya Sharma',
      marksObtained: 18,
      isAbsent: false,
      percentage: 36,
    },
  ],
  createdAt: '2026-09-20T00:00:00.000Z',
};

describe('TestsPage', () => {
  it('lists the batch’s tests with their scores', async () => {
    server.use(
      http.get(`${API_URL}/batches`, () => HttpResponse.json({ data: [batch] })),
      http.get(`${API_URL}/tests/batch/b1`, () => HttpResponse.json({ data: [test] })),
    );
    signInAs(OWNER);
    renderWithIntl(<TestsPage />);

    const card = await screen.findByRole('link', { name: /Unit Test 3/ });
    expect(card).toHaveAttribute('href', '/app/tests/t1');
    expect(within(card).getByText('50 marks')).toBeInTheDocument();
    expect(within(card).getByText('2 results entered')).toBeInTheDocument();
    expect(within(card).getByText('Average 31.5')).toBeInTheDocument();
  });
});

describe('TestFormDialog', () => {
  it('creates a test for the batch, using the batch subject by default', async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/tests`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...test, id: 't9', results: [] } }, { status: 201 });
      }),
    );
    signInAs(OWNER);
    const onCreated = vi.fn();
    renderWithIntl(
      <TestFormDialog open onOpenChange={() => {}} batch={batch} onCreated={onCreated} />,
    );

    expect(screen.getByLabelText('Subject')).toHaveValue('Physics');
    await userEvent.type(screen.getByLabelText('Test name'), 'Unit Test 4');
    await userEvent.type(screen.getByLabelText('Total marks'), '40');
    await userEvent.type(screen.getByLabelText(/Pass mark/), '16');
    await userEvent.click(screen.getByRole('button', { name: 'Create test' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(body).toEqual({
      batchId: 'b1',
      title: 'Unit Test 4',
      subject: 'Physics',
      testDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      totalMarks: 40,
      passingMarks: 16,
    });
  });

  it('rejects a pass mark above the total', async () => {
    signInAs(OWNER);
    renderWithIntl(<TestFormDialog open onOpenChange={() => {}} batch={batch} />);

    await userEvent.type(screen.getByLabelText('Test name'), 'Quiz');
    await userEvent.type(screen.getByLabelText('Total marks'), '20');
    await userEvent.type(screen.getByLabelText(/Pass mark/), '25');
    await userEvent.click(screen.getByRole('button', { name: 'Create test' }));

    expect(
      await screen.findByText("The pass mark can't be more than the total marks."),
    ).toBeInTheDocument();
  });

  it('removes the pass mark when it is cleared on edit', async () => {
    let body: unknown;
    server.use(
      http.put(`${API_URL}/tests/t1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: test });
      }),
    );
    signInAs(OWNER);
    const onOpenChange = vi.fn();
    renderWithIntl(<TestFormDialog open onOpenChange={onOpenChange} test={test} />);

    await userEvent.clear(screen.getByLabelText(/Pass mark/));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(body).toEqual({ passingMarks: null });
  });
});

describe('TestDetail marks entry', () => {
  beforeEach(() => {
    server.use(
      http.get(`${API_URL}/tests/t1`, () => HttpResponse.json({ data: test })),
      http.get(`${API_URL}/batches/b1/students`, () => HttpResponse.json({ data: roster })),
    );
  });

  it('shows saved marks, stats and pass/fail', async () => {
    signInAs(OWNER);
    renderWithIntl(<TestDetail id="t1" />);

    expect(await screen.findByLabelText('Marks for Aarav Sharma')).toHaveValue('45');
    expect(screen.getByText('31.5')).toBeInTheDocument();
    // 1 of the 2 who sat reached the pass mark of 20
    expect(screen.getByText('1/2')).toBeInTheDocument();
    const diya = screen.getByLabelText('Marks for Diya Sharma').closest('li')!;
    expect(within(diya).getByText('Fail')).toBeInTheDocument();
  });

  it('enters marks down the list with Enter and saves only filled rows', async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/tests/t1/marks`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: test });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<TestDetail id="t1" />);

    const diya = await screen.findByLabelText('Marks for Diya Sharma');
    await userEvent.clear(diya);
    await userEvent.type(diya, '22.5{Enter}');
    expect(screen.getByLabelText('Marks for Kabir Sharma')).toHaveFocus();
    expect(within(diya.closest('li')!).getByText('Pass')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save marks' }));

    await waitFor(() =>
      expect(body).toEqual({
        results: [
          { studentId: 's1', marksObtained: 45, isAbsent: false },
          { studentId: 's2', marksObtained: 22.5, isAbsent: false },
        ],
      }),
    );
    expect(screen.getByText(/Students left blank are not saved/)).toBeInTheDocument();
  });

  it('blocks saving a mark above the total', async () => {
    signInAs(OWNER);
    renderWithIntl(<TestDetail id="t1" />);

    await userEvent.type(await screen.findByLabelText('Marks for Kabir Sharma'), '55');

    expect(screen.getByText('Max 50')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save marks' })).toBeDisabled();
  });

  it('records an absent student instead of a zero', async () => {
    let body: { results: unknown[] } | undefined;
    server.use(
      http.post(`${API_URL}/tests/t1/marks`, async ({ request }) => {
        body = (await request.json()) as { results: unknown[] };
        return HttpResponse.json({ data: test });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<TestDetail id="t1" />);

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Kabir Sharma was absent' }));
    expect(screen.getByLabelText('Marks for Kabir Sharma')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save marks' }));

    await waitFor(() =>
      expect(body?.results).toContainEqual({ studentId: 's3', marksObtained: 0, isAbsent: true }),
    );
  });

  it('deletes the test and returns to its batch', async () => {
    server.use(http.delete(`${API_URL}/tests/t1`, () => HttpResponse.json({ data: {} })));
    signInAs(OWNER);
    renderWithIntl(<TestDetail id="t1" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Delete test' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete test' }),
    );

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/app/tests?batch=b1'));
  });

  it('is read-only without permission to create tests', async () => {
    signInAs({ ...OWNER, permissions: ['tests:read', 'batches:read'] });
    renderWithIntl(<TestDetail id="t1" />);

    expect(await screen.findByLabelText('Marks for Aarav Sharma')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save marks' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });
});

describe('StudentResults', () => {
  it('lists a student’s results with pass/fail', async () => {
    server.use(
      http.get(`${API_URL}/tests/student/s1`, () =>
        HttpResponse.json({
          data: [
            {
              testId: 't1',
              title: 'Unit Test 3',
              subject: 'Physics',
              testDate: '2026-09-20T00:00:00.000Z',
              totalMarks: 50,
              passingMarks: 20,
              marksObtained: 45,
              isAbsent: false,
              percentage: 90,
            },
            {
              testId: 't2',
              title: 'Unit Test 2',
              subject: 'Physics',
              testDate: '2026-09-10T00:00:00.000Z',
              totalMarks: 50,
              passingMarks: 20,
              marksObtained: 0,
              isAbsent: true,
              percentage: 0,
            },
          ],
        }),
      ),
    );
    signInAs(OWNER);
    renderWithIntl(<StudentResults studentId="s1" />);

    expect(await screen.findByText('45/50')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
    expect(screen.getByText('Absent')).toBeInTheDocument();
  });
});

describe('marks helpers', () => {
  it.each([
    ['40', 50, 40],
    ['37.5', 50, 37.5],
    ['0', 50, 0],
    ['', 50, null],
    ['51', 50, null],
    ['-1', 50, null],
    ['abc', 50, null],
  ])('parseMark(%s of %s) = %s', (value, total, expected) => {
    expect(parseMark(value, total)).toBe(expected);
  });

  it('saves absent and valid rows only', () => {
    expect(
      entriesToSave(
        {
          s1: { marks: '40', absent: false },
          s2: { marks: '', absent: false },
          s3: { marks: '12', absent: true },
          s4: { marks: '99', absent: false },
        },
        50,
      ),
    ).toEqual([
      { studentId: 's1', marksObtained: 40, isAbsent: false },
      { studentId: 's3', marksObtained: 0, isAbsent: true },
    ]);
  });

  it('decides pass/fail only when there is a pass mark', () => {
    expect(hasPassed(20, false, 20)).toBe(true);
    expect(hasPassed(19.5, false, 20)).toBe(false);
    expect(hasPassed(45, true, 20)).toBe(false);
    expect(hasPassed(45, false, null)).toBeNull();
  });
});
