'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SubmitButton } from '@/components/auth/submit-button';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import {
  changedFields,
  fullName,
  type Student,
  useAddParent,
  useBatches,
  useCreateStudent,
  useEnrolStudent,
  useUpdateStudent,
} from '@/lib/academics';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { isValidPhone, normalisePhone } from '@/lib/phone';
import { useApiError } from '@/lib/use-api-error';

export const RELATIONS = ['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'] as const;
const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;

const STUDENT_FIELDS = [
  'firstName',
  'lastName',
  'rollNumber',
  'gender',
  'dob',
  'phone',
  'email',
  'address',
  'joiningDate',
] as const;

/** Today in India as YYYY-MM-DD, the default joining date */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this student; omit to add a new one */
  student?: Student;
  onCreated?: (student: Student) => void;
}

export function StudentFormDialog({
  open,
  onOpenChange,
  student,
  onCreated,
}: StudentFormDialogProps) {
  const t = useTranslations('Students.form');
  const common = useTranslations('Common');
  const editing = Boolean(student);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('editTitle') : t('createTitle')}
      closeLabel={common('close')}
      size="lg"
    >
      {/* Remount per opening so the form starts from the student's current values */}
      {open ? (
        <StudentForm student={student} onDone={() => onOpenChange(false)} onCreated={onCreated} />
      ) : null}
    </Dialog>
  );
}

function StudentForm({
  student,
  onDone,
  onCreated,
}: {
  student?: Student;
  onDone: () => void;
  onCreated?: (student: Student) => void;
}) {
  const t = useTranslations('Students');
  const v = useTranslations('Auth.validation');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const user = useSession()?.user;
  const editing = Boolean(student);
  // Parent and batch are captured with a new student so they are not forgotten; edits of those
  // happen on the student's profile
  const withParent = !editing && can(user, 'students:create');
  const withBatch = !editing && can(user, 'batches:update');
  const batches = useBatches();
  const [formError, setFormError] = useState<string | null>(null);

  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent(student?.id ?? '');
  const addParent = useAddParent();
  const enrol = useEnrolStudent();

  const schema = useMemo(() => {
    const optionalPhone = z
      .string()
      .refine((value) => !value.trim() || isValidPhone(value), v('phone'));
    return z
      .object({
        firstName: z.string().trim().min(1, v('required')).max(100),
        lastName: z.string().trim().min(1, v('required')).max(100),
        rollNumber: z.string().trim().max(50),
        gender: z.enum(['', ...GENDERS]),
        dob: z.string(),
        phone: optionalPhone,
        email: z
          .string()
          .trim()
          .refine((value) => !value || z.string().email().safeParse(value).success, v('email')),
        address: z.string().trim(),
        joiningDate: z.string(),
        parentName: z.string().trim(),
        parentPhone: z.string(),
        relation: z.enum(RELATIONS),
        batchId: z.string(),
      })
      .superRefine((values, ctx) => {
        // A parent needs both a name and a number; either one alone is a half-filled form
        if (!withParent) return;
        const hasName = values.parentName.length > 0;
        const hasPhone = values.parentPhone.trim().length > 0;
        if (hasName && !hasPhone) {
          ctx.addIssue({ code: 'custom', path: ['parentPhone'], message: v('required') });
        } else if (hasPhone && !isValidPhone(values.parentPhone)) {
          ctx.addIssue({ code: 'custom', path: ['parentPhone'], message: v('phone') });
        }
        if (hasPhone && values.parentName.length < 2) {
          ctx.addIssue({ code: 'custom', path: ['parentName'], message: v('nameMin') });
        }
      });
  }, [v, withParent]);
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: student?.firstName ?? '',
      lastName: student?.lastName ?? '',
      rollNumber: student?.rollNumber ?? '',
      gender: student?.gender ?? '',
      dob: student?.dob?.slice(0, 10) ?? '',
      phone: student?.phone ?? '',
      email: student?.email ?? '',
      address: student?.address ?? '',
      joiningDate: todayInIndia(),
      parentName: '',
      parentPhone: '',
      relation: 'FATHER',
      batchId: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const details = {
      firstName: values.firstName,
      lastName: values.lastName,
      rollNumber: values.rollNumber,
      gender: values.gender || undefined,
      dob: values.dob,
      phone: values.phone ? normalisePhone(values.phone) : '',
      email: values.email.toLowerCase(),
      address: values.address,
    };

    if (student) {
      const changes = changedFields(
        { ...student, dob: student.dob?.slice(0, 10) } as Record<string, unknown>,
        details,
      );
      if (Object.keys(changes).length === 0) {
        onDone();
        return;
      }
      try {
        await updateStudent.mutateAsync(changes);
        toast.success(t('form.updated'));
        onDone();
      } catch (error) {
        setFormError(describeError(error, setError, STUDENT_FIELDS));
      }
      return;
    }

    let created: Student;
    try {
      created = await createStudent.mutateAsync({ ...details, joiningDate: values.joiningDate });
    } catch (error) {
      setFormError(describeError(error, setError, STUDENT_FIELDS));
      return;
    }

    // The student exists now; a failed follow-up step must not look like the whole form failed
    const name = fullName(created);
    const failed: string[] = [];
    if (withParent && values.parentName) {
      await addParent
        .mutateAsync({
          name: values.parentName,
          phone: normalisePhone(values.parentPhone),
          relation: values.relation,
          studentId: created.id,
          isPrimary: true,
        })
        .catch(() => failed.push(t('form.stepParent')));
    }
    if (withBatch && values.batchId) {
      await enrol
        .mutateAsync({ batchId: values.batchId, studentId: created.id })
        .catch(() => failed.push(t('form.stepBatch')));
    }

    if (failed.length) toast.warning(t('form.partial', { name, step: failed.join(', ') }));
    else toast.success(t('form.created', { name }));
    onCreated?.(created);
    onDone();
  });

  const sectionTitle = 'text-sm font-semibold tracking-wide text-muted-foreground uppercase';

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <fieldset className="flex flex-col gap-4">
        {!editing ? (
          <legend className={`mb-4 ${sectionTitle}`}>{t('form.studentSection')}</legend>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="firstName" label={t('form.firstName')} error={errors.firstName?.message}>
            <Input autoComplete="off" autoFocus {...register('firstName')} />
          </FormField>
          <FormField id="lastName" label={t('form.lastName')} error={errors.lastName?.message}>
            <Input autoComplete="off" {...register('lastName')} />
          </FormField>
          <FormField
            id="rollNumber"
            label={t('form.rollNumber')}
            error={errors.rollNumber?.message}
          >
            <Input autoComplete="off" {...register('rollNumber')} />
          </FormField>
          <FormField id="gender" label={t('form.gender')} error={errors.gender?.message}>
            <Select {...register('gender')}>
              <option value="">{t('form.genderUnset')}</option>
              {GENDERS.map((gender) => (
                <option key={gender} value={gender}>
                  {t(`gender.${gender}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="dob" label={t('form.dob')} error={errors.dob?.message}>
            <Input type="date" max={todayInIndia()} {...register('dob')} />
          </FormField>
          {!editing ? (
            <FormField
              id="joiningDate"
              label={t('form.joiningDate')}
              error={errors.joiningDate?.message}
            >
              <Input type="date" {...register('joiningDate')} />
            </FormField>
          ) : null}
          <FormField id="phone" label={t('form.phone')} error={errors.phone?.message}>
            <Input type="tel" inputMode="tel" autoComplete="off" {...register('phone')} />
          </FormField>
          <FormField id="email" label={t('form.email')} error={errors.email?.message}>
            <Input type="email" inputMode="email" autoComplete="off" {...register('email')} />
          </FormField>
        </div>
        <FormField id="address" label={t('form.address')} error={errors.address?.message}>
          <Input autoComplete="off" {...register('address')} />
        </FormField>
      </fieldset>

      {withParent ? (
        <fieldset className="flex flex-col gap-4">
          <legend className={`mb-1 ${sectionTitle}`}>{t('form.parentSection')}</legend>
          <p className="text-sm text-muted-foreground">{t('form.parentHint')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="parentName"
              label={t('form.parentName')}
              error={errors.parentName?.message}
            >
              <Input autoComplete="off" {...register('parentName')} />
            </FormField>
            <FormField
              id="parentPhone"
              label={t('form.parentPhone')}
              error={errors.parentPhone?.message}
            >
              <Input type="tel" inputMode="tel" autoComplete="off" {...register('parentPhone')} />
            </FormField>
            <FormField id="relation" label={t('form.relation')}>
              <Select {...register('relation')}>
                {RELATIONS.map((relation) => (
                  <option key={relation} value={relation}>
                    {t(`relation.${relation}`)}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </fieldset>
      ) : null}

      {withBatch && batches.data?.length ? (
        <fieldset className="flex flex-col gap-4">
          <legend className={`mb-4 ${sectionTitle}`}>{t('form.batchSection')}</legend>
          <FormField id="batchId" label={t('form.batch')}>
            <Select {...register('batchId')}>
              <option value="">{t('form.noBatch')}</option>
              {batches.data
                .filter((batch) => batch.isActive)
                .map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.subject ? `${batch.name} · ${batch.subject}` : batch.name}
                  </option>
                ))}
            </Select>
          </FormField>
        </fieldset>
      ) : null}

      <div className="flex justify-end border-t pt-5">
        <div className="w-full sm:w-48">
          <SubmitButton
            pending={isSubmitting}
            label={editing ? common('save') : t('form.create')}
            pendingLabel={editing ? common('saving') : t('form.creating')}
          />
        </div>
      </div>
    </form>
  );
}
