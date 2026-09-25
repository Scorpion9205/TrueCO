import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Batch, Teacher } from '@/lib/academics';
import { API_URL } from '@/lib/api';
import { __resetSessionForTests } from '@/lib/auth/session';
import { generatePassword } from '@/lib/teachers';
import { renderWithIntl } from '@/test/render';
import { OWNER, signInAs } from '@/test/session';
import { filterTeachers, TeachersPage } from './teachers-page';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => __resetSessionForTests());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const teacher = (id: string, name: string, overrides: Partial<Teacher> = {}): Teacher => ({
  id,
  name,
  phone: '9876500001',
  email: `${id}@sharma.in`,
  specialization: 'Physics',
  monthlySalary: 20000,
  isActive: true,
  assignedBatches: [],
  ...overrides,
});

const batch = (id: string, name: string): Batch => ({
  id,
  name,
  academicYear: '2026-27',
  daysOfWeek: [],
  isActive: true,
  createdAt: '2026-04-01T00:00:00.000Z',
});

function teachersApi(teachers: Teacher[]) {
  server.use(http.get(`${API_URL}/teachers`, () => HttpResponse.json({ data: teachers })));
}

describe('TeachersPage', () => {
  it('shows active teachers with their batches and salary', async () => {
    teachersApi([
      teacher('t1', 'Anita Rao', {
        assignedBatches: [{ batchId: 'b1', batchName: 'Class 10 Maths', isPrimary: true }],
      }),
      teacher('t2', 'Old Teacher', { isActive: false }),
      teacher('t3', 'Chetan Das', { monthlySalary: null, specialization: null }),
    ]);
    signInAs(OWNER);
    renderWithIntl(<TeachersPage />);

    expect(await screen.findByText('Anita Rao')).toBeInTheDocument();
    expect(screen.getByText('2 active teachers')).toBeInTheDocument();
    expect(screen.queryByText('Old Teacher')).toBeNull();
    expect(screen.getByRole('link', { name: 'Class 10 Maths' })).toHaveAttribute(
      'href',
      '/app/batches/b1',
    );
    expect(screen.getByText('₹20,000 / month')).toBeInTheDocument();
    expect(screen.getByText('No monthly salary set')).toBeInTheDocument();
    expect(screen.getByText('Not teaching any batch yet')).toBeInTheDocument();
  });

  it('explains the page when there are no teachers', async () => {
    teachersApi([]);
    signInAs(OWNER);
    renderWithIntl(<TeachersPage />);

    expect(await screen.findByText('No teachers yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add teacher' }).length).toBeGreaterThan(0);
  });

  it('adds a teacher and shows the sign-in details to share once', async () => {
    teachersApi([]);
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API_URL}/teachers`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { data: teacher('t9', 'Anita Rao', { email: 'anita@sharma.in' }) },
          { status: 201 },
        );
      }),
      http.get(`${API_URL}/coachings/me`, () =>
        HttpResponse.json({ data: { id: 'c1', name: 'Sharma Classes', code: 'sharma-classes' } }),
      ),
    );
    signInAs(OWNER);
    renderWithIntl(<TeachersPage />);

    await userEvent.click((await screen.findAllByRole('button', { name: 'Add teacher' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Add teacher' });
    await userEvent.type(within(dialog).getByLabelText('Full name'), 'Anita Rao');
    await userEvent.type(within(dialog).getByLabelText('Mobile number'), '98765 00001');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'Anita@Sharma.in');
    await userEvent.type(within(dialog).getByLabelText(/Monthly salary/), '20,000');
    const password = within(dialog).getByLabelText('Sign-in password') as HTMLInputElement;
    // A password is made up for the owner, long enough for the API
    expect(password.value).toHaveLength(10);
    await userEvent.clear(password);
    await userEvent.type(password, 'Welcome@123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add teacher' }));

    const done = await screen.findByRole('dialog', { name: 'Teacher added' });
    expect(body).toMatchObject({
      name: 'Anita Rao',
      phone: '9876500001',
      email: 'anita@sharma.in',
      password: 'Welcome@123',
      monthlySalary: 20000,
    });
    expect(body).not.toHaveProperty('specialization');
    expect(within(done).getByText('Welcome@123')).toBeInTheDocument();
    expect(await within(done).findByText('sharma-classes')).toBeInTheDocument();
  });

  it('points at the email when someone already signs in with it', async () => {
    teachersApi([]);
    server.use(
      http.post(`${API_URL}/teachers`, () =>
        HttpResponse.json({ error: { code: 'EMAIL_TAKEN', message: 'taken' } }, { status: 409 }),
      ),
    );
    signInAs(OWNER);
    renderWithIntl(<TeachersPage />);

    await userEvent.click((await screen.findAllByRole('button', { name: 'Add teacher' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Add teacher' });
    await userEvent.type(within(dialog).getByLabelText('Full name'), 'Anita Rao');
    await userEvent.type(within(dialog).getByLabelText('Mobile number'), '9876500001');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'owner@sharma.in');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add teacher' }));

    expect(
      await within(dialog).findByText(
        'Someone in your institute already signs in with this email.',
      ),
    ).toBeInTheDocument();
  });

  it('clears a monthly salary on edit, sending only that change', async () => {
    teachersApi([teacher('t1', 'Anita Rao')]);
    let body: unknown;
    server.use(
      http.put(`${API_URL}/teachers/t1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: teacher('t1', 'Anita Rao', { monthlySalary: null }) });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<TeachersPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit: Anita Rao' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit teacher' });
    expect(within(dialog).getByLabelText('Email')).toHaveAttribute('readonly');
    await userEvent.clear(within(dialog).getByLabelText(/Monthly salary/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(body).toEqual({ monthlySalary: null }));
  });

  it('marks a teacher inactive after confirming', async () => {
    teachersApi([teacher('t1', 'Anita Rao')]);
    let body: unknown;
    server.use(
      http.put(`${API_URL}/teachers/t1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: teacher('t1', 'Anita Rao', { isActive: false }) });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<TeachersPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Mark inactive' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Mark inactive' }),
    );
    await waitFor(() => expect(body).toEqual({ isActive: false }));
  });

  it('assigns and removes batches', async () => {
    teachersApi([
      teacher('t1', 'Anita Rao', {
        assignedBatches: [{ batchId: 'b1', batchName: 'Class 10 Maths', isPrimary: true }],
      }),
    ]);
    const calls: string[] = [];
    server.use(
      http.get(`${API_URL}/batches`, () =>
        HttpResponse.json({
          data: [batch('b1', 'Class 10 Maths'), batch('b2', 'Class 12 Physics')],
        }),
      ),
      http.post(`${API_URL}/batches/:id/teachers`, async ({ params, request }) => {
        calls.push(
          `add ${params.id} ${((await request.json()) as { teacherId: string }).teacherId}`,
        );
        return HttpResponse.json({ data: {} });
      }),
      http.delete(`${API_URL}/batches/:id/teachers/:teacherId`, ({ params }) => {
        calls.push(`remove ${params.id} ${params.teacherId}`);
        return HttpResponse.json({ data: {} });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<TeachersPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Batches' }));
    const dialog = await screen.findByRole('dialog', { name: "Anita Rao's batches" });
    // Only batches they don't teach yet are offered
    const select = within(dialog).getByLabelText('Batch');
    await within(dialog).findByRole('option', { name: 'Class 12 Physics' });
    expect(within(dialog).queryByRole('option', { name: 'Class 10 Maths' })).toBeNull();
    await userEvent.selectOptions(select, 'b2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remove from Class 10 Maths' }),
    );

    await waitFor(() => expect(calls).toEqual(['add b2 t1', 'remove b1 t1']));
  });

  it('shows teachers without actions to someone who can only read them', async () => {
    teachersApi([teacher('t1', 'Anita Rao')]);
    signInAs({ ...OWNER, permissions: ['teachers:read'] });
    renderWithIntl(<TeachersPage />);

    await screen.findByText('Anita Rao');
    expect(screen.queryByRole('button', { name: 'Add teacher' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull();
    // Salaries are only for those who can see payroll
    expect(screen.queryByText('₹20,000 / month')).toBeNull();
  });
});

describe('teacher helpers', () => {
  const list = [
    teacher('t1', 'Anita Rao', { phone: '+91 98765 00001' }),
    teacher('t2', 'Bharat Singh', { specialization: 'Chemistry', phone: '9123400000' }),
    teacher('t3', 'Chetan Das', { isActive: false }),
  ];

  it('filters by status, name, subject and phone digits', () => {
    expect(filterTeachers(list, '', 'active').map((t) => t.id)).toEqual(['t1', 't2']);
    expect(filterTeachers(list, '', 'inactive').map((t) => t.id)).toEqual(['t3']);
    expect(filterTeachers(list, 'chem', 'all').map((t) => t.id)).toEqual(['t2']);
    expect(filterTeachers(list, '98765', 'all').map((t) => t.id)).toEqual(['t1', 't3']);
    expect(filterTeachers(list, 'rao', 'all').map((t) => t.id)).toEqual(['t1']);
  });

  it('makes unambiguous passwords', () => {
    const password = generatePassword();
    expect(password).toHaveLength(10);
    expect(password).not.toMatch(/[0O1lI]/);
    expect(generatePassword()).not.toBe(password);
  });
});
