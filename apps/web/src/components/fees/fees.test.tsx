import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '@/lib/api';
import { __resetSessionForTests } from '@/lib/auth/session';
import { addDays } from '@/lib/attendance';
import { todayInIndia } from '@/lib/dates';
import {
  addMonths,
  type FeeInstallment,
  type FeePlan,
  finalAmount,
  isOverdue,
  splitAmount,
  sumRupees,
} from '@/lib/fees';
import { numberInWords, rupeesInWords } from '@/lib/money-words';
import { renderWithIntl } from '@/test/render';
import { OWNER, signInAs, TEACHER } from '@/test/session';
import { parseRupees } from '@/lib/fees';
import { FeePlanDialog } from './fee-plan-dialog';
import { daysBetween, FeesPage, groupOverdue } from './fees-page';
import { PaymentDialog } from './payment-dialog';
import { ReceiptView } from './receipt-view';
import { StudentFees } from './student-fees';

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

const today = todayInIndia();

function installment(overrides: Partial<FeeInstallment> = {}): FeeInstallment {
  return {
    id: 'i1',
    feePlanId: 'p1',
    installmentNo: 1,
    amount: 5000,
    paidAmount: 0,
    balanceAmount: 5000,
    dueDate: `${addDays(today, 10)}T00:00:00.000Z`,
    status: 'PENDING',
    transactions: [],
    ...overrides,
  };
}

const plan: FeePlan = {
  id: 'p1',
  studentId: 's1',
  studentName: 'Aarav Sharma',
  totalAmount: 12000,
  discountType: 'FIXED',
  discountValue: 2000,
  finalAmount: 10000,
  academicYear: '2026-27',
  totalPaid: 3000,
  totalPending: 7000,
  installments: [
    installment({
      id: 'i1',
      installmentNo: 1,
      amount: 5000,
      paidAmount: 3000,
      balanceAmount: 2000,
      status: 'PARTIAL',
      dueDate: `${addDays(today, -5)}T00:00:00.000Z`,
      transactions: [
        {
          id: 'tx1',
          installmentId: 'i1',
          amount: 3000,
          paymentMethod: 'UPI',
          transactionRef: 'UPI123',
          receiptNumber: 'RCT-0001',
          paidAt: '2026-09-02T05:30:00.000Z',
        },
      ],
    }),
    installment({ id: 'i2', installmentNo: 2 }),
  ],
  createdAt: '2026-06-01T00:00:00.000Z',
};

describe('money helpers', () => {
  it('applies discounts to the paisa like the API', () => {
    expect(finalAmount(10000)).toBe(10000);
    expect(finalAmount(10000, 'PERCENTAGE', 10)).toBe(9000);
    expect(finalAmount(999.99, 'PERCENTAGE', 12.5)).toBe(874.99);
    expect(finalAmount(10000, 'FIXED', 2500.5)).toBe(7499.5);
    expect(finalAmount(1000, 'FIXED', 5000)).toBe(0);
  });

  it('splits an amount into parts that add up exactly', () => {
    expect(splitAmount(10000, 3)).toEqual([3333.33, 3333.33, 3333.34]);
    expect(sumRupees(splitAmount(10000, 3))).toBe(10000);
    expect(sumRupees(splitAmount(0.1 + 0.2, 7))).toBe(0.3);
  });

  it('keeps month-end due dates inside short months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('reads typed rupee amounts', () => {
    expect(parseRupees('25,000')).toBe(25000);
    expect(parseRupees('2500.50')).toBe(2500.5);
    expect(parseRupees('2500.555')).toBeNull();
    expect(parseRupees('0')).toBeNull();
    expect(parseRupees('abc')).toBeNull();
  });

  it('writes amounts in words the Indian way', () => {
    expect(numberInWords(125500)).toBe('One Lakh Twenty-Five Thousand Five Hundred');
    expect(numberInWords(20_000_000)).toBe('Two Crore');
    expect(rupeesInWords(25000)).toBe('Rupees Twenty-Five Thousand Only');
    expect(rupeesInWords(1250.5)).toBe(
      'Rupees One Thousand Two Hundred Fifty and Fifty Paise Only',
    );
  });

  it('treats unpaid past-due instalments as overdue', () => {
    const past = `${addDays(today, -1)}T00:00:00.000Z`;
    expect(isOverdue(installment({ dueDate: past }), today)).toBe(true);
    expect(isOverdue(installment({ dueDate: `${today}T00:00:00.000Z` }), today)).toBe(false);
    expect(isOverdue(installment({ dueDate: past, status: 'PAID' }), today)).toBe(false);
    expect(isOverdue(installment({ dueDate: past, status: 'WAIVED' }), today)).toBe(false);
  });
});

describe('FeePlanDialog', () => {
  it('splits the fee after discount into equal instalments and creates the plan', async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/fees/plans`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: plan }, { status: 201 });
      }),
    );
    signInAs(OWNER);
    const onOpenChange = vi.fn();
    renderWithIntl(<FeePlanDialog open onOpenChange={onOpenChange} studentId="s1" />);

    await userEvent.type(screen.getByLabelText('Total fee (₹)'), '11000');
    await userEvent.selectOptions(screen.getByLabelText('Discount'), 'FIXED');
    await userEvent.type(screen.getByLabelText('Discount value'), '1000');
    await userEvent.selectOptions(screen.getByLabelText('Instalments'), '3');
    const firstDue = screen.getByLabelText('First due date');
    await userEvent.clear(firstDue);
    await userEvent.type(firstDue, '2026-01-31');

    expect(screen.getByLabelText('Amount for instalment 1')).toHaveValue('3333.33');
    expect(screen.getByLabelText('Amount for instalment 3')).toHaveValue('3333.34');
    expect(screen.getByLabelText('Due date for instalment 2')).toHaveValue('2026-02-28');
    expect(screen.getByRole('status')).toHaveTextContent('Instalments add up to ₹10,000');

    await userEvent.click(screen.getByRole('button', { name: 'Create fee plan' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(body).toEqual({
      studentId: 's1',
      academicYear: expect.stringMatching(/^\d{4}-\d{2}$/),
      totalAmount: 11000,
      discountType: 'FIXED',
      discountValue: 1000,
      installments: [
        { installmentNo: 1, amount: 3333.33, dueDate: '2026-01-31' },
        { installmentNo: 2, amount: 3333.33, dueDate: '2026-02-28' },
        { installmentNo: 3, amount: 3333.34, dueDate: '2026-03-31' },
      ],
    });
  });

  it('will not create a plan whose instalments do not add up', async () => {
    signInAs(OWNER);
    renderWithIntl(<FeePlanDialog open onOpenChange={() => {}} studentId="s1" />);

    await userEvent.type(screen.getByLabelText('Total fee (₹)'), '10000');
    await userEvent.selectOptions(screen.getByLabelText('Instalments'), '2');
    const first = screen.getByLabelText('Amount for instalment 1');
    await userEvent.clear(first);
    await userEvent.type(first, '6000');

    expect(screen.getByRole('status')).toHaveTextContent('₹11,000 — ₹1,000 more than the fee');
    expect(screen.getByRole('button', { name: 'Create fee plan' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Split equally again' }));
    expect(screen.getByLabelText('Amount for instalment 1')).toHaveValue('5000');
  });
});

describe('PaymentDialog', () => {
  const partial = plan.installments![0]!;

  it('takes the balance by default and records a UPI payment with its reference', async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/fees/pay`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          data: { ...partial.transactions![0], id: 'tx2', receiptNumber: 'RCT-0002' },
        });
      }),
    );
    signInAs(OWNER);
    const onOpenChange = vi.fn();
    renderWithIntl(
      <PaymentDialog
        open
        onOpenChange={onOpenChange}
        installment={partial}
        studentId="s1"
        studentName="Aarav Sharma"
      />,
    );

    expect(screen.getByLabelText('Amount (₹)')).toHaveValue('2000');
    await userEvent.selectOptions(screen.getByLabelText('Paid by'), 'UPI');
    await userEvent.type(screen.getByLabelText(/Reference/), 'UPI987');
    await userEvent.click(screen.getByRole('button', { name: 'Record payment' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(body).toEqual({
      installmentId: 'i1',
      amount: 2000,
      paymentMethod: 'UPI',
      transactionRef: 'UPI987',
    });
  });

  it('refuses more than the balance', async () => {
    signInAs(OWNER);
    renderWithIntl(
      <PaymentDialog
        open
        onOpenChange={() => {}}
        installment={partial}
        studentId="s1"
        studentName="Aarav Sharma"
      />,
    );

    const amount = screen.getByLabelText('Amount (₹)');
    await userEvent.clear(amount);
    await userEvent.type(amount, '2500');

    expect(screen.getByText('This is more than the ₹2,000 still due.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeDisabled();
  });
});

describe('StudentFees', () => {
  beforeEach(() => {
    server.use(http.get(`${API_URL}/fees/students/s1`, () => HttpResponse.json({ data: [plan] })));
  });

  it('shows waived amounts separately from what is pending', async () => {
    server.use(
      http.get(`${API_URL}/fees/students/s1`, () =>
        HttpResponse.json({ data: [{ ...plan, totalPending: 2000, totalWaived: 5000 }] }),
      ),
    );
    signInAs(OWNER);
    renderWithIntl(<StudentFees studentId="s1" studentName="Aarav Sharma" />);

    expect(await screen.findByText('₹5,000 waived')).toBeInTheDocument();
    expect(screen.getByText('₹2,000 pending')).toBeInTheDocument();
  });

  it('shows the plan, overdue instalments and receipts', async () => {
    signInAs(OWNER);
    renderWithIntl(<StudentFees studentId="s1" studentName="Aarav Sharma" />);

    expect(await screen.findByText('₹3,000 paid of ₹10,000')).toBeInTheDocument();
    expect(screen.getByText('₹7,000 pending')).toBeInTheDocument();
    expect(screen.getByText('₹2,000 discount')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View receipt RCT-0001' })).toHaveAttribute(
      'href',
      '/app/fees/receipts/tx1?student=s1',
    );
    expect(screen.getAllByRole('button', { name: 'Record payment' })).toHaveLength(2);
  });

  it('waives an instalment after confirming', async () => {
    let waived = false;
    server.use(
      http.post(`${API_URL}/fees/installments/i2/waive`, () => {
        waived = true;
        return HttpResponse.json({ data: {} });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<StudentFees studentId="s1" studentName="Aarav Sharma" />);

    const waiveButtons = await screen.findAllByRole('button', { name: 'Waive' });
    await userEvent.click(waiveButtons[1]!);
    const dialog = screen.getByRole('alertdialog', { name: 'Waive instalment 2?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Waive ₹5,000' }));

    await waitFor(() => expect(waived).toBe(true));
  });

  it('hides money actions from people without fee permissions', async () => {
    signInAs({ ...TEACHER, permissions: [...TEACHER.permissions, 'fees:read'] });
    renderWithIntl(<StudentFees studentId="s1" studentName="Aarav Sharma" />);

    await screen.findByText('₹7,000 pending');
    expect(screen.queryByRole('button', { name: 'Record payment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Waive' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add fee plan' })).toBeNull();
  });
});

describe('FeesPage', () => {
  it('groups overdue fees by student and prepares a WhatsApp reminder to the parent', async () => {
    const due = (days: number) => `${addDays(today, -days)}T00:00:00.000Z`;
    server.use(
      http.get(`${API_URL}/fees/defaulters`, () =>
        HttpResponse.json({
          data: [
            {
              installmentId: 'i1',
              installmentNo: 1,
              amount: 5000,
              paidAmount: 3000,
              pendingAmount: 2000,
              dueDate: due(40),
              status: 'PARTIAL',
              student: { id: 's1', name: 'Aarav Sharma' },
              parent: { name: 'Rakesh Sharma', phone: '9876543210' },
            },
            {
              installmentId: 'i2',
              installmentNo: 2,
              amount: 5000,
              paidAmount: 0,
              pendingAmount: 5000,
              dueDate: due(10),
              status: 'PENDING',
              student: { id: 's1', name: 'Aarav Sharma' },
              parent: { name: 'Rakesh Sharma', phone: '9876543210' },
            },
            {
              installmentId: 'i3',
              installmentNo: 1,
              amount: 1500.5,
              paidAmount: 0,
              pendingAmount: 1500.5,
              dueDate: due(3),
              status: 'PENDING',
              student: { id: 's2', name: 'Diya Verma' },
              parent: null,
            },
          ],
        }),
      ),
      http.get(`${API_URL}/dashboard/owner`, () =>
        HttpResponse.json({
          data: {
            metrics: {
              totalStudents: 2,
              totalTeachers: 0,
              totalBatches: 1,
              monthlyRevenue: 45000,
              monthlyPendingFees: 12000,
              monthlyExpenses: 0,
              todayAttendanceRate: null,
              highRiskCount: 0,
            },
            recentActivities: [],
            upcomingInstallments: [],
          },
        }),
      ),
      http.get(`${API_URL}/coachings/me`, () =>
        HttpResponse.json({ data: { id: 'c1', name: 'Sharma Classes', subscription: {} } }),
      ),
    );
    signInAs(OWNER);
    renderWithIntl(<FeesPage />);

    expect(await screen.findByText('2 students · ₹8,500.50 overdue')).toBeInTheDocument();
    expect(screen.getByText('₹45,000')).toBeInTheDocument();
    const aarav = screen.getByRole('link', { name: 'Aarav Sharma' }).closest('li')!;
    expect(within(aarav).getByText('₹7,000')).toBeInTheDocument();
    expect(within(aarav).getByText('2 instalments · 40 days late')).toBeInTheDocument();

    const remind = within(aarav).getByRole('link', { name: 'Remind on WhatsApp' });
    const href = decodeURIComponent(remind.getAttribute('href')!);
    expect(href).toMatch(/^https:\/\/wa\.me\/919876543210\?text=Dear Rakesh Sharma/);
    expect(href).toContain('Sharma Classes');
    expect(href).toContain('₹7,000');

    const diya = screen.getByRole('link', { name: 'Diya Verma' }).closest('li')!;
    expect(within(diya).getByText('No parent number')).toBeInTheDocument();
  });

  it('celebrates when nothing is overdue', async () => {
    server.use(http.get(`${API_URL}/fees/defaulters`, () => HttpResponse.json({ data: [] })));
    signInAs({ ...TEACHER, permissions: ['fees:read'] });
    renderWithIntl(<FeesPage />);

    expect(await screen.findByText('No overdue fees. Everyone is up to date.')).toBeInTheDocument();
  });
});

describe('ReceiptView', () => {
  it('prints the payment with the amount in words', async () => {
    server.use(
      http.get(`${API_URL}/fees/students/s1`, () => HttpResponse.json({ data: [plan] })),
      http.get(`${API_URL}/coachings/me`, () =>
        HttpResponse.json({
          data: {
            id: 'c1',
            name: 'Sharma Classes',
            city: 'Kota',
            phone: '9876500000',
            subscription: {},
          },
        }),
      ),
    );
    signInAs(OWNER);
    renderWithIntl(<ReceiptView transactionId="tx1" studentId="s1" />);

    expect(await screen.findByText('RCT-0001')).toBeInTheDocument();
    expect(await screen.findByText('Sharma Classes')).toBeInTheDocument();
    expect(screen.getByText('₹3,000')).toBeInTheDocument();
    expect(screen.getByText('Rupees Three Thousand Only')).toBeInTheDocument();
    expect(screen.getByText('UPI123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
  });

  it('explains a receipt that cannot be found', async () => {
    server.use(
      http.get(`${API_URL}/fees/students/s1`, () => HttpResponse.json({ data: [plan] })),
      http.get(`${API_URL}/coachings/me`, () =>
        HttpResponse.json({ data: { name: 'X', subscription: {} } }),
      ),
    );
    signInAs(OWNER);
    renderWithIntl(<ReceiptView transactionId="nope" studentId="s1" />);

    expect(await screen.findByText('This receipt could not be found.')).toBeInTheDocument();
  });
});

describe('overdue grouping', () => {
  it('counts days late between calendar days', () => {
    expect(daysBetween('2026-09-01', '2026-09-25')).toBe(24);
  });

  it('sums each student in paise and puts the longest overdue first', () => {
    const rows = groupOverdue([
      {
        installmentId: 'a',
        installmentNo: 1,
        amount: 0.1,
        paidAmount: 0,
        pendingAmount: 0.1,
        dueDate: '2026-09-10',
        status: 'PENDING',
        student: { id: 's1', name: 'A' },
      },
      {
        installmentId: 'b',
        installmentNo: 2,
        amount: 0.2,
        paidAmount: 0,
        pendingAmount: 0.2,
        dueDate: '2026-09-01',
        status: 'PENDING',
        student: { id: 's1', name: 'A' },
      },
      {
        installmentId: 'c',
        installmentNo: 1,
        amount: 9,
        paidAmount: 0,
        pendingAmount: 9,
        dueDate: '2026-09-05',
        status: 'PENDING',
        student: { id: 's2', name: 'B' },
      },
    ]);
    expect(rows.map((r) => [r.studentName, r.total, r.oldestDue, r.instalments])).toEqual([
      ['A', 0.3, '2026-09-01', 2],
      ['B', 9, '2026-09-05', 1],
    ]);
  });
});
