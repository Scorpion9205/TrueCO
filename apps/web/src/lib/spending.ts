'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './auth/session';
import type { PaymentMethod } from './fees';
import { useQueryScope } from './queries';

// ---------- Expenses (apps/api expenses DTOs; money in rupees, dates as ISO strings) ----------

/** Common categories offered in the form; any other text is allowed too */
export const EXPENSE_CATEGORIES = [
  'RENT',
  'UTILITIES',
  'STATIONERY',
  'MARKETING',
  'MAINTENANCE',
  'TRAVEL',
  'OTHER',
] as const;

export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  receiptUrl?: string | null;
  remarks?: string | null;
  createdAt: string;
}

export interface ExpenseInput {
  title: string;
  category: string;
  amount: number;
  /** YYYY-MM-DD */
  expenseDate: string;
  paymentMethod: PaymentMethod;
  receiptUrl?: string;
  remarks?: string;
}

export interface ExpenseSummary {
  total: number;
  count: number;
  byCategory: Record<string, number>;
}

export const EXPENSES_PAGE_SIZE = 50;

// ---------- Salary ----------

export type SalaryStatus = 'PENDING' | 'PAID';

export interface Salary {
  id: string;
  teacherId: string;
  teacherName?: string;
  amount: number;
  month: number;
  year: number;
  status: SalaryStatus;
  paidAt?: string | null;
  paymentMethod?: PaymentMethod | null;
  remarks?: string | null;
  createdAt: string;
}

export interface SalaryTeacher {
  id: string;
  name: string;
  specialization?: string | null;
  monthlySalary?: number | null;
  isActive: boolean;
}

/** "2026-09" -> { month: 9, year: 2026 } */
export function monthParts(month: string): { month: number; year: number } {
  const [year, m] = month.split('-').map(Number) as [number, number];
  return { month: m, year };
}

// ---------- Queries ----------

export function useExpenses(month: [string, string], page: number) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'expenses', 'list', month, page],
    queryFn: ({ signal }) =>
      api.getPage<Expense>('/expenses', {
        signal,
        query: {
          startDate: month[0],
          endDate: month[1],
          limit: EXPENSES_PAGE_SIZE,
          offset: (page - 1) * EXPENSES_PAGE_SIZE,
        },
      }),
  });
}

export function useExpenseSummary(month: string) {
  const scope = useQueryScope();
  const parts = monthParts(month);
  return useQuery({
    queryKey: [scope, 'expenses', 'summary', month],
    queryFn: ({ signal }) => api.get<ExpenseSummary>('/expenses/summary', { signal, query: parts }),
  });
}

export function useSalaries(month: string, enabled = true) {
  const scope = useQueryScope();
  const parts = monthParts(month);
  return useQuery({
    queryKey: [scope, 'salary', month],
    queryFn: ({ signal }) => api.get<Salary[]>('/salary', { signal, query: parts }),
    enabled,
  });
}

export function useSalaryTeachers(enabled = true) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'teachers', 'list'],
    queryFn: ({ signal }) => api.get<SalaryTeacher[]>('/teachers', { signal }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

// ---------- Mutations ----------

/** Spending moves the dashboard's monthly expenses too */
function useInvalidate(...keys: string[]) {
  const queryClient = useQueryClient();
  const scope = useQueryScope();
  return () =>
    Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [scope, key] })));
}

export function useCreateExpense() {
  const invalidate = useInvalidate('expenses', 'dashboard');
  return useMutation({
    mutationFn: (input: ExpenseInput) => api.post<Expense>('/expenses', input),
    onSuccess: invalidate,
  });
}

export function useUpdateExpense(id: string) {
  const invalidate = useInvalidate('expenses', 'dashboard');
  return useMutation({
    mutationFn: (input: Partial<ExpenseInput>) => api.put<Expense>(`/expenses/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidate('expenses', 'dashboard');
  return useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: invalidate,
  });
}

export function useGenerateSalary() {
  const invalidate = useInvalidate('salary');
  return useMutation({
    mutationFn: (input: { teacherId: string; month: number; year: number; amount: number }) =>
      api.post<Salary>('/salary/generate', input),
    onSuccess: invalidate,
  });
}

export function usePaySalary() {
  const invalidate = useInvalidate('salary');
  return useMutation({
    mutationFn: (input: {
      salaryId: string;
      paymentMethod: PaymentMethod;
      paidAt?: string;
      remarks?: string;
    }) => api.post<Salary>('/salary/pay', input),
    onSuccess: invalidate,
  });
}
