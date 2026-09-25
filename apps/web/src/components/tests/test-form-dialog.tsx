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
import { toast } from '@/components/ui/toaster';
import { changedFields } from '@/lib/academics';
import { type Test, type TestUpdate, useCreateTest, useUpdateTest } from '@/lib/assessments';
import { todayInIndia } from '@/lib/dates';
import type { TeachingBatch } from '@/lib/teaching-batches';
import { useApiError } from '@/lib/use-api-error';

interface TestFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The batch a new test is for */
  batch?: TeachingBatch;
  /** Edit this test; omit to create one */
  test?: Test;
  onCreated?: (test: Test) => void;
}

export function TestFormDialog({
  open,
  onOpenChange,
  batch,
  test,
  onCreated,
}: TestFormDialogProps) {
  const t = useTranslations('Tests.form');
  const common = useTranslations('Common');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={test ? t('editTitle') : t('createTitle')}
      description={test ? undefined : batch?.name}
      closeLabel={common('close')}
    >
      {open ? (
        <TestForm
          batch={batch}
          test={test}
          onDone={() => onOpenChange(false)}
          onCreated={onCreated}
        />
      ) : null}
    </Dialog>
  );
}

/** "40" / "37.5" -> number; blank -> undefined (marks may have halves) */
const toNumber = (value: string) => (value.trim() === '' ? undefined : Number(value));

function TestForm({
  batch,
  test,
  onDone,
  onCreated,
}: {
  batch?: TeachingBatch;
  test?: Test;
  onDone: () => void;
  onCreated?: (test: Test) => void;
}) {
  const t = useTranslations('Tests.form');
  const v = useTranslations('Auth.validation');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const create = useCreateTest();
  const update = useUpdateTest(test?.id ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(() => {
    const marks = (optional: boolean) =>
      z.string().refine((value) => {
        const n = toNumber(value);
        if (n === undefined) return optional;
        return Number.isFinite(n) && n > 0 && n <= 1000;
      }, t('marksRange'));
    return z
      .object({
        title: z.string().trim().min(1, v('required')).max(255),
        subject: z.string().trim().min(1, v('required')).max(100),
        testDate: z.string().min(1, v('required')),
        totalMarks: marks(false),
        passingMarks: marks(true),
      })
      .refine(
        (values) => {
          const pass = toNumber(values.passingMarks);
          return pass === undefined || pass <= Number(values.totalMarks);
        },
        { path: ['passingMarks'], message: t('passAboveTotal') },
      );
  }, [t, v]);
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: test?.title ?? '',
      subject: test?.subject ?? batch?.subject ?? '',
      testDate: test ? test.testDate.slice(0, 10) : todayInIndia(),
      totalMarks: test ? String(test.totalMarks) : '',
      passingMarks: test?.passingMarks ? String(test.passingMarks) : '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const details = {
      title: values.title,
      subject: values.subject,
      testDate: values.testDate,
      totalMarks: Number(values.totalMarks),
      passingMarks: toNumber(values.passingMarks),
    };
    const fields = ['title', 'subject', 'testDate', 'totalMarks', 'passingMarks'] as const;
    try {
      if (test) {
        const changes = changedFields(
          {
            ...test,
            testDate: test.testDate.slice(0, 10),
            passingMarks: test.passingMarks ?? undefined,
          } as Record<string, unknown>,
          details,
        );
        if (Object.keys(changes).length) {
          await update.mutateAsync(changes as TestUpdate);
          toast.success(t('updated'));
        }
        onDone();
        return;
      }
      if (!batch) return;
      const created = await create.mutateAsync({ ...details, batchId: batch.id });
      toast.success(t('created', { name: created.title }));
      onCreated?.(created);
      onDone();
    } catch (error) {
      setFormError(describeError(error, setError, fields));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <FormField id="test-title" label={t('title')} error={errors.title?.message}>
        <Input
          autoComplete="off"
          autoFocus
          placeholder={t('titlePlaceholder')}
          {...register('title')}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="test-subject" label={t('subject')} error={errors.subject?.message}>
          <Input autoComplete="off" {...register('subject')} />
        </FormField>
        <FormField id="test-date" label={t('testDate')} error={errors.testDate?.message}>
          <Input type="date" {...register('testDate')} />
        </FormField>
        <FormField id="test-total" label={t('totalMarks')} error={errors.totalMarks?.message}>
          <Input inputMode="decimal" autoComplete="off" {...register('totalMarks')} />
        </FormField>
        <FormField
          id="test-pass"
          label={t('passingMarks')}
          hint={t('passingHint')}
          error={errors.passingMarks?.message}
        >
          <Input inputMode="decimal" autoComplete="off" {...register('passingMarks')} />
        </FormField>
      </div>
      <div className="mt-2 flex justify-end border-t pt-5">
        <div className="w-full sm:w-48">
          <SubmitButton
            pending={isSubmitting}
            label={test ? common('save') : t('create')}
            pendingLabel={test ? common('saving') : t('creating')}
          />
        </div>
      </div>
    </form>
  );
}
