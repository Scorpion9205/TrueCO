'use client';

import { Banknote, CheckCircle2, GraduationCap, Loader2, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { QueryError } from '@/components/dashboard/query-error';
import { parseRupees } from '@/components/fees/fee-plan-dialog';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MonthPicker, useMonthParam } from '@/components/ui/month-picker';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { toast } from '@/components/ui/toaster';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { todayInIndia } from '@/lib/dates';
import { PAYMENT_METHODS, type PaymentMethod, sumRupees } from '@/lib/fees';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  monthParts,
  type Salary,
  type SalaryTeacher,
  useGenerateSalary,
  usePaySalary,
  useSalaries,
  useSalaryTeachers,
} from '@/lib/spending';
import { useApiError } from '@/lib/use-api-error';

/** "2026-09" -> "September 2026" */
export function monthName(month: string): string {
  const { month: m, year } = monthParts(month);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, m - 1, 1)));
}

export interface PayrollRow {
  teacher: SalaryTeacher;
  salary: Salary | null;
}

/**
 * One row per teacher for the month: active teachers, plus anyone (even inactive now) who has a
 * salary that month so past payroll stays complete. Unpaid first, then by name.
 */
export function payrollRows(teachers: SalaryTeacher[], salaries: Salary[]): PayrollRow[] {
  const byTeacher = new Map(salaries.map((salary) => [salary.teacherId, salary]));
  const rows: PayrollRow[] = teachers
    .filter((teacher) => teacher.isActive || byTeacher.has(teacher.id))
    .map((teacher) => ({ teacher, salary: byTeacher.get(teacher.id) ?? null }));
  const rank = (row: PayrollRow) => (!row.salary ? 1 : row.salary.status === 'PAID' ? 2 : 0);
  return rows.sort((a, b) => rank(a) - rank(b) || a.teacher.name.localeCompare(b.teacher.name));
}

export function SalaryPage() {
  const t = useTranslations('Salary');
  const user = useSession()?.user;
  const [month, setMonth] = useMonthParam();
  const teachers = useSalaryTeachers(can(user, 'teachers:read'));
  const salaries = useSalaries(month);
  const generate = useGenerateSalary();
  const [bulkRunning, setBulkRunning] = useState(false);
  const canManage = can(user, 'salary:manage');

  const loading = teachers.isPending || salaries.isPending;
  const error = teachers.error ?? salaries.error;
  const rows = teachers.data && salaries.data ? payrollRows(teachers.data, salaries.data) : [];
  const amounts = (salaries.data ?? []).map((salary) => salary.amount);
  const paid = sumRupees(
    (salaries.data ?? []).filter((s) => s.status === 'PAID').map((s) => s.amount),
  );
  const payroll = sumRupees(amounts);
  // Teachers whose monthly salary is known and who have nothing for this month yet
  const ready = rows.filter(
    (row) => !row.salary && row.teacher.isActive && row.teacher.monthlySalary,
  );

  const generateAll = async () => {
    setBulkRunning(true);
    const { month: m, year } = monthParts(month);
    let done = 0;
    let failed = 0;
    // One at a time: a handful of teachers, and each failure is reported rather than lost
    for (const row of ready) {
      try {
        await generate.mutateAsync({
          teacherId: row.teacher.id,
          month: m,
          year,
          amount: row.teacher.monthlySalary!,
        });
        done += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkRunning(false);
    if (failed) toast.warning(t('generatedSome', { done, failed }));
    else toast.success(t('generatedAll', { count: done }));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <MonthPicker month={month} onChange={setMonth} />
        {canManage && ready.length ? (
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button
              onClick={() => void generateAll()}
              disabled={bulkRunning}
              aria-busy={bulkRunning}
            >
              {bulkRunning ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Wand2 aria-hidden />
              )}
              {t('generateAll')}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t('generateAllHint', { count: ready.length })}
            </p>
          </div>
        ) : null}
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard
          label={t('kpi.payroll')}
          value={salaries.data ? formatCurrency(payroll) : '—'}
          icon={Banknote}
        />
        <KpiCard
          label={t('kpi.paid')}
          value={salaries.data ? formatCurrency(paid) : '—'}
          icon={CheckCircle2}
        />
        <KpiCard
          label={t('kpi.pending')}
          value={salaries.data ? formatCurrency(sumRupees([payroll, -paid])) : '—'}
          icon={Banknote}
          tone={payroll > paid ? 'attention' : 'default'}
          className="col-span-2 lg:col-span-1"
        />
      </section>

      {loading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <QueryError
          error={error}
          onRetry={() => {
            void teachers.refetch();
            void salaries.refetch();
          }}
        />
      ) : rows.length === 0 ? (
        <StatePanel
          icon={<GraduationCap className="size-5" aria-hidden />}
          title={t('empty.title')}
        >
          <p>{t('empty.body')}</p>
          <Button asChild variant="outline" className="mt-2">
            <Link href="/app/teachers">{t('empty.goToTeachers')}</Link>
          </Button>
        </StatePanel>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {rows.map((row) => (
            <PayrollItem key={row.teacher.id} row={row} month={month} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PayrollItem({ row, month }: { row: PayrollRow; month: string }) {
  const t = useTranslations('Salary');
  const methods = useTranslations('Fees.method');
  const user = useSession()?.user;
  const [generating, setGenerating] = useState(false);
  const [paying, setPaying] = useState(false);
  const { teacher, salary } = row;
  const status = salary?.status ?? 'none';

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-semibold">{teacher.name}</p>
        <p className="text-xs text-muted-foreground">
          {salary?.status === 'PAID' && salary.paidAt
            ? t('paidOn', {
                date: formatDate(salary.paidAt),
                method: salary.paymentMethod ? methods(salary.paymentMethod) : '',
              })
            : [teacher.specialization, teacher.monthlySalary ? null : t('noDefault')]
                .filter(Boolean)
                .join(' · ')}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold tabular-nums">
          {salary
            ? formatCurrency(salary.amount)
            : teacher.monthlySalary
              ? formatCurrency(teacher.monthlySalary)
              : '—'}
        </span>
        <Badge tone={status === 'PAID' ? 'success' : status === 'PENDING' ? 'warning' : 'neutral'}>
          {t(`status.${status}`)}
        </Badge>
        {!salary && can(user, 'salary:manage') ? (
          <Button size="sm" variant="outline" onClick={() => setGenerating(true)}>
            {t('generate')}
          </Button>
        ) : null}
        {salary?.status === 'PENDING' && can(user, 'salary:pay') ? (
          <Button size="sm" onClick={() => setPaying(true)}>
            {t('pay')}
          </Button>
        ) : null}
      </div>
      <GenerateDialog
        open={generating}
        onOpenChange={setGenerating}
        teacher={teacher}
        month={month}
      />
      {salary ? (
        <PayDialog
          open={paying}
          onOpenChange={setPaying}
          salary={salary}
          teacherName={teacher.name}
        />
      ) : null}
    </li>
  );
}

function GenerateDialog({
  open,
  onOpenChange,
  teacher,
  month,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: SalaryTeacher;
  month: string;
}) {
  const t = useTranslations('Salary.generateForm');
  const fees = useTranslations('Fees');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const generate = useGenerateSalary();
  const [amount, setAmount] = useState(teacher.monthlySalary ? String(teacher.monthlySalary) : '');
  const [error, setError] = useState<string | null>(null);
  const value = parseRupees(amount);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (value === null) return;
    setError(null);
    try {
      await generate.mutateAsync({ teacherId: teacher.id, ...monthParts(month), amount: value });
      toast.success(t('done', { teacher: teacher.name }));
      onOpenChange(false);
    } catch (err) {
      setError(describeError(err));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      description={t('for', { teacher: teacher.name, month: monthName(month) })}
      closeLabel={common('close')}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <FormField
          id="salary-amount"
          label={t('amount')}
          error={amount && value === null ? fees('plan.amountInvalid') : undefined}
        >
          <Input
            inputMode="decimal"
            autoFocus
            className="tabular-nums"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </FormField>
        <Button
          type="submit"
          size="lg"
          disabled={value === null || generate.isPending}
          aria-busy={generate.isPending}
        >
          {generate.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {generate.isPending ? t('submitting') : t('submit')}
        </Button>
      </form>
    </Dialog>
  );
}

function PayDialog({
  open,
  onOpenChange,
  salary,
  teacherName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salary: Salary;
  teacherName: string;
}) {
  const t = useTranslations('Salary.payForm');
  const methods = useTranslations('Fees.method');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const pay = usePaySalary();
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [date, setDate] = useState(todayInIndia());
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await pay.mutateAsync({
        salaryId: salary.id,
        paymentMethod: method,
        // Noon in India, so the stored day never shifts across a time zone boundary
        paidAt: new Date(`${date}T12:00:00+05:30`).toISOString(),
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      });
      toast.success(t('done', { teacher: teacherName }));
      onOpenChange(false);
    } catch (err) {
      setError(describeError(err));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      description={t('for', { teacher: teacherName, amount: formatCurrency(salary.amount) })}
      closeLabel={common('close')}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="salary-method" label={t('method')}>
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {methods(option)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="salary-date" label={t('date')}>
            <Input
              type="date"
              max={todayInIndia()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </FormField>
        </div>
        <FormField id="salary-remarks" label={t('remarks')}>
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </FormField>
        <Button type="submit" size="lg" disabled={!date || pay.isPending} aria-busy={pay.isPending}>
          {pay.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pay.isPending ? t('submitting') : t('submit')}
        </Button>
      </form>
    </Dialog>
  );
}
