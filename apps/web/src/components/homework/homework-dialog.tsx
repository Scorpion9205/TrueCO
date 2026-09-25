'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SubmitButton } from '@/components/auth/submit-button';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { changedFields } from '@/lib/academics';
import {
  type Homework,
  type HomeworkUpdate,
  useCreateHomework,
  useUpdateHomework,
} from '@/lib/assessments';
import { addDays, toDay } from '@/lib/attendance';
import { todayInIndia } from '@/lib/dates';
import type { TeachingBatch } from '@/lib/teaching-batches';
import { useApiError } from '@/lib/use-api-error';

export function HomeworkDialog({
  open,
  onOpenChange,
  batch,
  homework,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch?: TeachingBatch;
  homework?: Homework;
}) {
  const t = useTranslations('Homework.form');
  const common = useTranslations('Common');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={homework ? t('editTitle') : t('createTitle')}
      description={homework ? undefined : batch?.name}
      closeLabel={common('close')}
    >
      {open ? (
        <HomeworkForm batch={batch} homework={homework} onDone={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  );
}

function HomeworkForm({
  batch,
  homework,
  onDone,
}: {
  batch?: TeachingBatch;
  homework?: Homework;
  onDone: () => void;
}) {
  const t = useTranslations('Homework.form');
  const v = useTranslations('Auth.validation');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const create = useCreateHomework();
  const update = useUpdateHomework(homework?.id ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(1, v('required')).max(255),
        description: z.string().trim().min(1, v('required')),
        dueDate: z.string().min(1, v('required')),
        attachmentUrl: z
          .string()
          .trim()
          .refine((value) => !value || /^https?:\/\/\S+$/i.test(value), t('invalidUrl')),
      }),
    [t, v],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: homework?.title ?? '',
      description: homework?.description ?? '',
      dueDate: homework ? toDay(homework.dueDate) : addDays(todayInIndia(), 1),
      attachmentUrl: homework?.attachmentUrl ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const fields = ['title', 'description', 'dueDate', 'attachmentUrl'] as const;
    try {
      if (homework) {
        const changes = changedFields(
          { ...homework, dueDate: toDay(homework.dueDate) } as Record<string, unknown>,
          values,
        );
        // The API clears the link with "" rather than null
        if (changes.attachmentUrl === null) changes.attachmentUrl = '';
        if (Object.keys(changes).length) {
          await update.mutateAsync(changes as HomeworkUpdate);
          toast.success(t('updated'));
        }
        onDone();
        return;
      }
      if (!batch) return;
      await create.mutateAsync({
        batchId: batch.id,
        title: values.title,
        description: values.description,
        dueDate: values.dueDate,
        ...(values.attachmentUrl ? { attachmentUrl: values.attachmentUrl } : {}),
      });
      toast.success(t('created'));
      onDone();
    } catch (error) {
      setFormError(describeError(error, setError, fields));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <FormField id="hw-title" label={t('title')} error={errors.title?.message}>
        <Input
          autoComplete="off"
          autoFocus
          placeholder={t('titlePlaceholder')}
          {...register('title')}
        />
      </FormField>
      <FormField id="hw-description" label={t('description')} error={errors.description?.message}>
        <Textarea rows={5} {...register('description')} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="hw-due" label={t('dueDate')} error={errors.dueDate?.message}>
          <Input type="date" {...register('dueDate')} />
        </FormField>
      </div>
      <FormField
        id="hw-link"
        label={t('attachmentUrl')}
        hint={t('attachmentHint')}
        error={errors.attachmentUrl?.message}
      >
        <Input type="url" inputMode="url" autoComplete="off" {...register('attachmentUrl')} />
      </FormField>
      {!homework ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageCircle className="size-3.5 text-whatsapp" aria-hidden />
          {t('parentsNotified')}
        </p>
      ) : null}
      <div className="mt-2 flex justify-end border-t pt-5">
        <div className="w-full sm:w-48">
          <SubmitButton
            pending={isSubmitting}
            label={homework ? common('save') : t('create')}
            pendingLabel={homework ? common('saving') : t('creating')}
          />
        </div>
      </div>
    </form>
  );
}
