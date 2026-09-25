import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API_URL } from '@/lib/api';
import { monthRange } from '@/lib/attendance';
import { __resetSessionForTests } from '@/lib/auth/session';
import { todayInIndia } from '@/lib/dates';
import type { Expense, Salary, SalaryTeacher } from '@/lib/spending';
import { renderWithIntl } from '@/test/render';
import { OWNER, signInAs } from '@/test/session';
import { ExpensesPage } from './expenses-page';
import { monthName, payrollRows, SalaryPage } from './salary-page';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => __resetSessionForTests());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const month = todayInIndia().slice(0, 7);
const [monthStart, monthEnd] = monthRange(month);

const expense = (id: string, overrides: Partial<Expense> = {}): Expense => ({
  id,
  title: 'September rent',
  category: 'RENT',
  amount: 15000,
  expenseDate: `${monthStart}T00:00:00.000Z`,
  paymentMethod: 'BANK_TRANSFER',
  receiptUrl: null,
  remarks: null,
  createdAt: `${monthStart}T00:00:00.000Z`,
  ...overrides,
});

const teacher = (
  id: string,
  name: string,
  monthlySalary: number | null,
  isActive = true,
): SalaryTeacher => ({
  id,
  name,
  monthlySalary,
  isActive,
});

const salary = (
  id: string,
  teacherId: string,
  status: Salary['status'],
  amount = 20000,
): Salary => ({
  id,
  teacherId,
  amount,
  month: Number(month.slice(5)),
  year: Number(month.slice(0, 4)),
  status,
  paidAt: status === 'PAID' ? `${monthStart}T06:30:00.000Z` : null,
  paymentMethod: status === 'PAID' ? 'UPI' : null,
  createdAt: `${monthStart}T00:00:00.000Z`,
});

function expensesApi(items: Expense[], salaries: Salary[] = []) {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get(`${API_URL}/expenses`, ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        data: items,
        meta: { total: items.length, limit: 50, offset: 0 },
      });
    }),
    http.get(`${API_URL}/expenses/summary`, () =>
      HttpResponse.json({
        data: {
          total: 17500.5,
          count: items.length,
          byCategory: { RENT: 15000, 'Water cans': 2500.5 },
        },
      }),
    ),
    http.get(`${API_URL}/salary`, () => HttpResponse.json({ data: salaries })),
  );
  return requests;
}

describe('ExpensesPage', () => {
  it('shows the month’s spending, salaries paid and a category breakdown', async () => {
    const requests = expensesApi(
      [expense('e1'), expense('e2', { title: 'Water', category: 'Water cans', amount: 2500.5 })],
      [salary('s1', 't1', 'PAID', 20000), salary('s2', 't2', 'PENDING', 18000)],
    );
    signInAs(OWNER);
    renderWithIntl(<ExpensesPage />);

    expect(await screen.findByText('₹17,500.50')).toBeInTheDocument();
    expect(await screen.findByText('₹20,000')).toBeInTheDocument();
    expect(screen.getByText('₹37,500.50')).toBeInTheDocument();
    // Known categories are translated; custom ones show as typed
    expect(screen.getAllByText('Rent').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Water cans').length).toBeGreaterThan(0);
    expect(requests[0]?.get('startDate')).toBe(monthStart);
    expect(requests[0]?.get('endDate')).toBe(monthEnd);
  });

  it('adds an expense with a custom category', async () => {
    expensesApi([]);
    let body: unknown;
    server.use(
      http.post(`${API_URL}/expenses`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: expense('e9') }, { status: 201 });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<ExpensesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Add expense' }));
    const dialog = screen.getByRole('dialog', { name: 'Add expense' });
    await userEvent.type(within(dialog).getByLabelText('What was it for?'), 'Water cans for Sept');
    await userEvent.selectOptions(within(dialog).getByLabelText('Category'), '__custom__');
    await userEvent.type(within(dialog).getByLabelText('Category name'), 'Water');
    await userEvent.type(within(dialog).getByLabelText('Amount (₹)'), '1,250.50');
    await userEvent.selectOptions(within(dialog).getByLabelText('Paid by'), 'UPI');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));

    await waitFor(() =>
      expect(body).toEqual({
        title: 'Water cans for Sept',
        category: 'Water',
        amount: 1250.5,
        expenseDate: todayInIndia(),
        paymentMethod: 'UPI',
      }),
    );
  });

  it('clears a receipt link when it is emptied on edit', async () => {
    expensesApi([expense('e1', { receiptUrl: 'https://example.com/bill.pdf' })]);
    let body: unknown;
    server.use(
      http.put(`${API_URL}/expenses/e1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: expense('e1') });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<ExpensesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit: September rent' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit expense' });
    await userEvent.clear(within(dialog).getByLabelText(/Link to bill/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(body).toEqual({ receiptUrl: '' }));
  });

  it('deletes after confirming', async () => {
    expensesApi([expense('e1')]);
    let deleted = false;
    server.use(
      http.delete(`${API_URL}/expenses/e1`, () => {
        deleted = true;
        return HttpResponse.json({ data: {} });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<ExpensesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Delete: September rent' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(deleted).toBe(true));
  });

  it('hides salaries and editing from someone who can only read expenses', async () => {
    expensesApi([expense('e1')]);
    signInAs({ ...OWNER, permissions: ['expenses:read'] });
    renderWithIntl(<ExpensesPage />);

    await screen.findByText('September rent');
    expect(screen.queryByText('Salaries paid')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull();
  });
});

describe('SalaryPage', () => {
  function salaryApi(teachers: SalaryTeacher[], salaries: Salary[]) {
    server.use(
      http.get(`${API_URL}/teachers`, () => HttpResponse.json({ data: teachers })),
      http.get(`${API_URL}/salary`, () => HttpResponse.json({ data: salaries })),
    );
  }

  it('shows the month’s payroll with unpaid salaries first', async () => {
    salaryApi(
      [
        teacher('t1', 'Anita', 20000),
        teacher('t2', 'Bharat', 18000),
        teacher('t3', 'Chetan', null),
      ],
      [salary('s1', 't1', 'PAID'), salary('s2', 't2', 'PENDING', 18000)],
    );
    signInAs(OWNER);
    renderWithIntl(<SalaryPage />);

    const names = (await screen.findAllByRole('listitem')).map(
      (item) => item.querySelector('p')?.textContent,
    );
    expect(names).toEqual(['Bharat', 'Chetan', 'Anita']);
    expect(screen.getByText('₹38,000')).toBeInTheDocument();
    expect(screen.getByText('No monthly salary set')).toBeInTheDocument();
  });

  it('adds salaries for everyone with a monthly salary, one by one', async () => {
    salaryApi(
      [
        teacher('t1', 'Anita', 20000),
        teacher('t2', 'Bharat', 18000),
        teacher('t3', 'Chetan', null),
      ],
      [],
    );
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API_URL}/salary/generate`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: salary('new', 'x', 'PENDING') }, { status: 201 });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<SalaryPage />);

    expect(await screen.findByText(/2 teachers have a monthly salary set/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add salaries for everyone' }));

    const { month: m, year } = { month: Number(month.slice(5)), year: Number(month.slice(0, 4)) };
    await waitFor(() =>
      expect(bodies).toEqual([
        { teacherId: 't1', month: m, year, amount: 20000 },
        { teacherId: 't2', month: m, year, amount: 18000 },
      ]),
    );
  });

  it('marks a salary paid on the chosen day', async () => {
    salaryApi([teacher('t2', 'Bharat', 18000)], [salary('s2', 't2', 'PENDING', 18000)]);
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API_URL}/salary/pay`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: salary('s2', 't2', 'PAID', 18000) });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<SalaryPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Mark paid' }));
    const dialog = screen.getByRole('dialog', { name: 'Mark salary paid' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Paid by'), 'UPI');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark paid' }));

    await waitFor(() => expect(body.salaryId).toBe('s2'));
    expect(body.paymentMethod).toBe('UPI');
    // Noon in India on the chosen day, so the date never shifts in UTC
    expect(body.paidAt).toBe(new Date(`${todayInIndia()}T12:00:00+05:30`).toISOString());
  });

  it('lets someone who can only read salaries see them without actions', async () => {
    salaryApi([teacher('t2', 'Bharat', 18000)], [salary('s2', 't2', 'PENDING', 18000)]);
    signInAs({ ...OWNER, permissions: ['salary:read', 'teachers:read'] });
    renderWithIntl(<SalaryPage />);

    await screen.findByText('Bharat');
    expect(screen.queryByRole('button', { name: 'Mark paid' })).toBeNull();
  });
});

describe('salary helpers', () => {
  it('names months', () => {
    expect(monthName('2026-09')).toBe('September 2026');
  });

  it('keeps inactive teachers only when they were paid that month', () => {
    const rows = payrollRows(
      [teacher('t1', 'Left in June', 15000, false), teacher('t2', 'Left earlier', 15000, false)],
      [salary('s1', 't1', 'PAID', 15000)],
    );
    expect(rows.map((row) => row.teacher.name)).toEqual(['Left in June']);
  });
});
