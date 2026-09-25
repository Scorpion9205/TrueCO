import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '@/lib/api';
import type { Batch, Student } from '@/lib/academics';
import { __resetSessionForTests } from '@/lib/auth/session';
import { renderWithIntl } from '@/test/render';
import { OWNER, signInAs, TEACHER } from '@/test/session';
import { BatchDetail } from './batch-detail';
import { BatchFormDialog } from './batch-form-dialog';
import { BatchesPage } from './batches-page';

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
  startTime: '07:00',
  endTime: '08:30',
  daysOfWeek: ['FRI', 'MON', 'WED'],
  isActive: true,
  activeStudentCount: 2,
  teachers: [{ teacherId: 't1', teacherName: 'Ravi Kumar', isPrimary: true }],
  createdAt: '2026-06-01T00:00:00.000Z',
};

const aarav: Student = {
  id: 's1',
  firstName: 'Aarav',
  lastName: 'Sharma',
  joiningDate: '2026-06-01T00:00:00.000Z',
  isActive: true,
  createdAt: '2026-06-01T00:00:00.000Z',
};
const diya: Student = { ...aarav, id: 's2', firstName: 'Diya' };

describe('BatchesPage', () => {
  it('shows each batch with its schedule, size and teachers', async () => {
    server.use(http.get(`${API_URL}/batches`, () => HttpResponse.json({ data: [batch] })));
    signInAs(OWNER);
    renderWithIntl(<BatchesPage />);

    const card = await screen.findByRole('link', { name: /Class 10 Morning/ });
    expect(card).toHaveAttribute('href', '/app/batches/b1');
    expect(within(card).getByText('Mon, Wed, Fri · 7:00 AM – 8:30 AM')).toBeInTheDocument();
    expect(within(card).getByText('2 students')).toBeInTheDocument();
    expect(within(card).getByText('Ravi Kumar')).toBeInTheDocument();
  });

  it('explains batches when there are none, without a create button for teachers', async () => {
    server.use(http.get(`${API_URL}/batches`, () => HttpResponse.json({ data: [] })));
    signInAs(TEACHER);
    renderWithIntl(<BatchesPage />);

    expect(await screen.findByText('No batches yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New batch' })).toBeNull();
  });
});

describe('BatchFormDialog', () => {
  it('creates a batch with chosen days, times and teachers', async () => {
    let body: unknown;
    server.use(
      http.get(`${API_URL}/teachers`, () =>
        HttpResponse.json({
          data: [{ id: 't1', name: 'Ravi Kumar', phone: '', email: '', isActive: true }],
        }),
      ),
      http.post(`${API_URL}/batches`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...batch, id: 'b9' } }, { status: 201 });
      }),
    );
    signInAs(OWNER);
    const onCreated = vi.fn();
    renderWithIntl(<BatchFormDialog open onOpenChange={() => {}} onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText('Batch name'), 'Class 10 Morning');
    await userEvent.click(screen.getByRole('button', { name: 'Mon' }));
    await userEvent.click(screen.getByRole('button', { name: 'Wed' }));
    expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.type(screen.getByLabelText('Starts at'), '07:00');
    await userEvent.type(screen.getByLabelText('Ends at'), '08:30');
    await userEvent.click(await screen.findByRole('checkbox', { name: /Ravi Kumar/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Create batch' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(body).toEqual({
      name: 'Class 10 Morning',
      academicYear: expect.stringMatching(/^\d{4}-\d{2}$/),
      daysOfWeek: ['MON', 'WED'],
      startTime: '07:00',
      endTime: '08:30',
      teacherIds: ['t1'],
    });
  });

  it('rejects a class that ends before it starts', async () => {
    server.use(http.get(`${API_URL}/teachers`, () => HttpResponse.json({ data: [] })));
    signInAs(OWNER);
    renderWithIntl(<BatchFormDialog open onOpenChange={() => {}} />);

    await userEvent.type(screen.getByLabelText('Batch name'), 'Evening');
    await userEvent.type(screen.getByLabelText('Starts at'), '18:00');
    await userEvent.type(screen.getByLabelText('Ends at'), '17:00');
    await userEvent.click(screen.getByRole('button', { name: 'Create batch' }));

    expect(await screen.findByText('End time must be after the start time.')).toBeInTheDocument();
  });
});

describe('BatchDetail', () => {
  beforeEach(() => {
    server.use(
      http.get(`${API_URL}/batches/b1`, () => HttpResponse.json({ data: batch })),
      http.get(`${API_URL}/batches/b1/students`, () => HttpResponse.json({ data: [diya, aarav] })),
    );
  });

  it('lists students alphabetically and removes one after confirming', async () => {
    let removed = false;
    server.use(
      http.delete(`${API_URL}/batches/b1/students/s1`, () => {
        removed = true;
        return HttpResponse.json({ data: {} });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<BatchDetail id="b1" />);

    const names = (await screen.findAllByRole('link', { name: /Sharma/ })).map(
      (l) => l.textContent,
    );
    expect(names).toEqual(['Aarav Sharma', 'Diya Sharma']);

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Aarav Sharma from Class 10 Morning?' }),
    );
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }),
    );
    await waitFor(() => expect(removed).toBe(true));
  });

  it('adds students found by search, marking those already enrolled', async () => {
    let enrolled: unknown;
    server.use(
      http.get(`${API_URL}/students`, () =>
        HttpResponse.json({
          data: [aarav, { ...aarav, id: 's3', firstName: 'Kabir' }],
          meta: { total: 2, page: 1, limit: 25 },
        }),
      ),
      http.post(`${API_URL}/batches/b1/students`, async ({ request }) => {
        enrolled = await request.json();
        return HttpResponse.json({ data: {} });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<BatchDetail id="b1" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Add students' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add students' });
    await within(dialog).findByText('Kabir Sharma');
    expect(within(dialog).getByText('Already in batch')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add Kabir Sharma' }));
    await waitFor(() => expect(enrolled).toEqual({ studentId: 's3' }));
  });

  it('is read-only for teachers', async () => {
    signInAs(TEACHER);
    renderWithIntl(<BatchDetail id="b1" />);

    await screen.findAllByRole('link', { name: /Sharma/ });
    expect(screen.queryByRole('button', { name: 'Add students' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  });

  it('edits a batch, sending only the changes', async () => {
    let body: unknown;
    server.use(
      http.put(`${API_URL}/batches/b1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: batch });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<BatchDetail id="b1" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit batch' });
    expect(within(dialog).getByLabelText('Batch name')).toHaveValue('Class 10 Morning');
    expect(within(dialog).queryByText('Teachers')).toBeNull();
    await userEvent.clear(within(dialog).getByLabelText('Subject'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fri' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(body).toEqual({ subject: null, daysOfWeek: ['MON', 'WED'] }));
  });

  it('marks a batch inactive', async () => {
    let body: unknown;
    server.use(
      http.put(`${API_URL}/batches/b1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...batch, isActive: false } });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<BatchDetail id="b1" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Mark inactive' }));
    await waitFor(() => expect(body).toEqual({ isActive: false }));
  });

  it('will not delete a batch with students, offering to archive it instead', async () => {
    let deleted = false;
    let body: unknown;
    server.use(
      http.delete(`${API_URL}/batches/b1`, () => {
        deleted = true;
        return HttpResponse.json({ data: {} });
      }),
      http.put(`${API_URL}/batches/b1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: batch });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<BatchDetail id="b1" />);
    await screen.findAllByRole('link', { name: /Sharma/ });

    await userEvent.click(screen.getByRole('button', { name: 'Delete batch' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('2 students are still in this batch');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark inactive' }));

    await waitFor(() => expect(body).toEqual({ isActive: false }));
    expect(deleted).toBe(false);
  });

  it('deletes an empty batch and returns to the list', async () => {
    server.use(
      http.get(`${API_URL}/batches/b1`, () =>
        HttpResponse.json({ data: { ...batch, activeStudentCount: 0 } }),
      ),
      http.get(`${API_URL}/batches/b1/students`, () => HttpResponse.json({ data: [] })),
      http.delete(`${API_URL}/batches/b1`, () => HttpResponse.json({ data: {} })),
    );
    signInAs(OWNER);
    renderWithIntl(<BatchDetail id="b1" />);
    await screen.findByText('No students in this batch yet.');

    await userEvent.click(screen.getByRole('button', { name: 'Delete batch' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete batch' }),
    );

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/app/batches'));
  });
});
