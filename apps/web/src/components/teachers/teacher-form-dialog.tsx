'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SubmitButton } from '@/components/auth/submit-button';
import { parseRupees } from '@/components/fees/fee-plan-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { toast } from '@/components/ui/toaster';
import { changedFields, type Teacher } from '@/lib/academics';
import { todayInIndia } from '@/lib/dates';
import { isValidPhone, normalisePhone } from '@/lib/phone';
import { useCoachingProfile } from '@/lib/queries';
import {
  generatePassword,
  MIN_PASSWORD_LENGTH,
  type TeacherUpdate,
  useCreateTeacher,
  useUpdateTeacher,
} from '@/lib/teachers';
import { useApiError } from '@/lib/use-api-error';

const TEACHER_FIELDS = [
  'name',
  'phone',
  'email',
  'password',
  'specialization',
  'monthlySalary',
  'joiningDate',
] as const;

interface SignIn {
  name: string;
  email: string;
  password: string;
}

interface TeacherFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this teacher; omit to add a new one */
  teacher?: Teacher;
}

export function TeacherFormDialog({ open, onOpenChange, teacher }: TeacherFormDialogProps) {
  const t = useTranslations('Teachers.form');
  const common = useTranslations('Common');
  // After adding, the dialog shows the sign-in details to share (the password is shown only once)
  const [signIn, setSignIn] = useState<SignIn | null>(null);

  const change = (next: boolean) => {
    if (!next) setSignIn(null);
    onOpenChange(next);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={change}
      title={signIn ? t('signIn.title') : teacher ? t('editTitle') : t('createTitle')}
      description={signIn ? t('signIn.body', { name: signIn.name }) : undefined}
      closeLabel={common('close')}
      size="lg"
    >
      {signIn ? (
        <SignInDetails details={signIn} onDone={() => change(false)} />
      ) : open ? (
        <TeacherForm
          teacher={teacher}
          onDone={() => change(false)}
          onCreated={(details) => setSignIn(details)}
        />
      ) : null}
    </Dialog>
  );
}

function TeacherForm({
  teacher,
  onDone,
  onCreated,
}: {
  teacher?: Teacher;
  onDone: () => void;
  onCreated: (details: SignIn) => void;
}) {
  const t = useTranslations('Teachers.form');
  const v = useTranslations('Auth.validation');
  const auth = useTranslations('Auth.fields');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const createTeacher = useCreateTeacher();
  const updateTeacher = useUpdateTeacher(teacher?.id ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const editing = Boolean(teacher);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, v('nameMin')).max(255),
        phone: z.string().refine(isValidPhone, v('phone')),
        email: z.string().trim().email(v('email')),
        password: editing
          ? z.string()
          : z.string().min(MIN_PASSWORD_LENGTH, v('passwordMin')).max(128),
        specialization: z.string().trim().max(255),
        monthlySalary: z
          .string()
          .refine((value) => !value.trim() || parseRupees(value) !== null, t('salaryInvalid')),
        joiningDate: z.string(),
      }),
    [v, t, editing],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: teacher?.name ?? '',
      phone: teacher?.phone ?? '',
      email: teacher?.email ?? '',
      password: editing ? '' : generatePassword(),
      specialization: teacher?.specialization ?? '',
      monthlySalary: teacher?.monthlySalary ? String(teacher.monthlySalary) : '',
      joiningDate: todayInIndia(),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const salary = values.monthlySalary.trim() ? parseRupees(values.monthlySalary) : null;

    if (teacher) {
      const changes = changedFields(
        {
          name: teacher.name,
          phone: teacher.phone,
          specialization: teacher.specialization ?? '',
          monthlySalary: teacher.monthlySalary ?? null,
        },
        {
          name: values.name,
          phone: normalisePhone(values.phone),
          specialization: values.specialization,
          monthlySalary: salary,
        },
      );
      if (Object.keys(changes).length === 0) {
        onDone();
        return;
      }
      try {
        // Name and phone are required by the form, so only subject and salary can be null
        await updateTeacher.mutateAsync(changes as TeacherUpdate);
        toast.success(t('updated', { name: values.name }));
        onDone();
      } catch (error) {
        setFormError(describeError(error, setError, TEACHER_FIELDS));
      }
      return;
    }

    try {
      const created = await createTeacher.mutateAsync({
        name: values.name,
        phone: normalisePhone(values.phone),
        email: values.email.toLowerCase(),
        password: values.password,
        ...(values.specialization ? { specialization: values.specialization } : {}),
        ...(salary !== null ? { monthlySalary: salary } : {}),
        ...(values.joiningDate ? { joiningDate: values.joiningDate } : {}),
      });
      onCreated({ name: created.name, email: created.email, password: values.password });
    } catch (error) {
      setFormError(describeError(error, setError, TEACHER_FIELDS));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="teacher-name" label={t('name')} error={errors.name?.message}>
          <Input autoComplete="off" autoFocus {...register('name')} />
        </FormField>
        <FormField id="teacher-phone" label={t('phone')} error={errors.phone?.message}>
          <Input type="tel" inputMode="tel" autoComplete="off" {...register('phone')} />
        </FormField>
        <FormField
          id="teacher-email"
          label={t('email')}
          hint={editing ? t('emailFixed') : t('emailHint')}
          error={errors.email?.message}
        >
          <Input
            type="email"
            inputMode="email"
            autoComplete="off"
            readOnly={editing}
            {...register('email')}
          />
        </FormField>
        <FormField
          id="teacher-specialization"
          label={`${t('specialization')} (${common('optional')})`}
          error={errors.specialization?.message}
        >
          <Input
            autoComplete="off"
            placeholder={t('specializationPlaceholder')}
            {...register('specialization')}
          />
        </FormField>
        <FormField
          id="teacher-salary"
          label={`${t('monthlySalary')} (${common('optional')})`}
          hint={t('monthlySalaryHint')}
          error={errors.monthlySalary?.message}
        >
          <Input inputMode="decimal" className="tabular-nums" {...register('monthlySalary')} />
        </FormField>
        {!editing ? (
          <FormField
            id="teacher-joining"
            label={t('joiningDate')}
            error={errors.joiningDate?.message}
          >
            <Input type="date" {...register('joiningDate')} />
          </FormField>
        ) : null}
      </div>

      {!editing ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-muted/40 p-4">
          <FormField
            id="teacher-password"
            label={t('password')}
            hint={t('passwordHint')}
            error={errors.password?.message}
            action={
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto"
                onClick={() =>
                  setValue('password', generatePassword(), {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              >
                <RefreshCw aria-hidden />
                {t('newPassword')}
              </Button>
            }
          >
            <PasswordInput
              autoComplete="new-password"
              showLabel={auth('showPassword')}
              hideLabel={auth('hidePassword')}
              {...register('password')}
            />
          </FormField>
        </div>
      ) : null}

      <div className="flex justify-end border-t pt-5">
        <div className="w-full sm:w-48">
          <SubmitButton
            pending={isSubmitting}
            label={editing ? common('save') : t('create')}
            pendingLabel={editing ? common('saving') : t('creating')}
          />
        </div>
      </div>
    </form>
  );
}

function SignInDetails({ details, onDone }: { details: SignIn; onDone: () => void }) {
  const t = useTranslations('Teachers.form.signIn');
  const code = useCoachingProfile().data?.code;
  const [copied, setCopied] = useState(false);
  const url = typeof window === 'undefined' ? '/login' : `${window.location.origin}/login`;

  const rows: Array<[string, string]> = [
    [t('page'), url],
    [t('email'), details.email],
    ...(code ? [[t('code'), code] as [string, string]] : []),
    [t('password'), details.password],
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        rows.map(([label, value]) => `${label}: ${value}`).join('\n'),
      );
      setCopied(true);
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <dl className="divide-y rounded-xl border">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:justify-between"
          >
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="font-mono text-sm font-semibold break-all select-all">{value}</dd>
          </div>
        ))}
      </dl>
      <Alert tone="warning">{t('once')}</Alert>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onDone}>
          {t('done')}
        </Button>
        <Button onClick={() => void copy()}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? t('copied') : t('copy')}
        </Button>
      </div>
    </div>
  );
}
