'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { SubmitButton } from '@/components/auth/submit-button';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import {
  type Batch,
  type BatchUpdate,
  changedFields,
  useCreateBatch,
  useTeachers,
  useUpdateBatch,
} from '@/lib/academics';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { currentAcademicYear, WEEK_DAYS } from '@/lib/schedule';
import { useApiError } from '@/lib/use-api-error';
import { cn } from '@/lib/utils';

interface BatchFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this batch; omit to create a new one */
  batch?: Batch;
  onCreated?: (batch: Batch) => void;
}

export function BatchFormDialog({ open, onOpenChange, batch, onCreated }: BatchFormDialogProps) {
  const t = useTranslations('Batches.form');
  const common = useTranslations('Common');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={batch ? t('editTitle') : t('createTitle')}
      closeLabel={common('close')}
      size="lg"
    >
      {open ? (
        <BatchForm batch={batch} onDone={() => onOpenChange(false)} onCreated={onCreated} />
      ) : null}
    </Dialog>
  );
}

function BatchForm({
  batch,
  onDone,
  onCreated,
}: {
  batch?: Batch;
  onDone: () => void;
  onCreated?: (batch: Batch) => void;
}) {
  const t = useTranslations('Batches.form');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const create = useCreateBatch();
  const update = useUpdateBatch(batch?.id ?? '');
  const user = useSession()?.user;
  // Teachers of an existing batch are managed on its page
  const canSeeTeachers = !batch && can(user, 'teachers:read');
  const teachers = useTeachers(canSeeTeachers);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(2, t('nameMin')).max(100),
          subject: z.string().trim().max(100),
          academicYear: z.string().trim().min(4, t('yearMin')).max(50),
          daysOfWeek: z.array(z.string()),
          startTime: z.string(),
          endTime: z.string(),
          teacherIds: z.array(z.string()),
        })
        .refine((v) => !v.startTime || !v.endTime || v.endTime > v.startTime, {
          path: ['endTime'],
          message: t('endBeforeStart'),
        }),
    [t],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: batch?.name ?? '',
      subject: batch?.subject ?? '',
      academicYear: batch?.academicYear ?? currentAcademicYear(),
      daysOfWeek: batch?.daysOfWeek ?? [],
      startTime: batch?.startTime ?? '',
      endTime: batch?.endTime ?? '',
      teacherIds: [],
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (batch) {
        const { teacherIds: _teachers, ...details } = values;
        const changes = changedFields(batch as unknown as Record<string, unknown>, details);
        if (Object.keys(changes).length > 0) {
          // Required fields are validated non-empty above, so only optional ones can become null
          await update.mutateAsync(changes as BatchUpdate);
          toast.success(t('updated'));
        }
        onDone();
        return;
      }
      const created = await create.mutateAsync({
        ...values,
        teacherIds: values.teacherIds.length ? values.teacherIds : undefined,
      });
      toast.success(t('created', { name: created.name }));
      onCreated?.(created);
      onDone();
    } catch (error) {
      setFormError(
        describeError(error, setError, ['name', 'subject', 'academicYear', 'startTime', 'endTime']),
      );
    }
  });

  const activeTeachers = (teachers.data ?? []).filter((teacher) => teacher.isActive);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="batch-name"
          label={t('name')}
          error={errors.name?.message}
          className="sm:col-span-2"
        >
          <Input
            autoComplete="off"
            autoFocus
            placeholder={t('namePlaceholder')}
            {...register('name')}
          />
        </FormField>
        <FormField id="batch-subject" label={t('subject')} error={errors.subject?.message}>
          <Input autoComplete="off" {...register('subject')} />
        </FormField>
        <FormField id="batch-year" label={t('academicYear')} error={errors.academicYear?.message}>
          <Input autoComplete="off" {...register('academicYear')} />
        </FormField>
        <FormField id="batch-start" label={t('startTime')} error={errors.startTime?.message}>
          <Input type="time" {...register('startTime')} />
        </FormField>
        <FormField id="batch-end" label={t('endTime')} error={errors.endTime?.message}>
          <Input type="time" {...register('endTime')} />
        </FormField>
      </div>

      <Controller
        control={control}
        name="daysOfWeek"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('days')}</legend>
            <div className="flex flex-wrap gap-2">
              {WEEK_DAYS.map((day) => {
                const selected = field.value.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      field.onChange(
                        selected ? field.value.filter((d) => d !== day) : [...field.value, day],
                      )
                    }
                    className={cn(
                      'h-10 min-w-12 rounded-full border px-3 text-sm font-semibold transition-colors',
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input hover:bg-muted',
                    )}
                  >
                    {common(`days.${day}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
      />

      {canSeeTeachers ? (
        <Controller
          control={control}
          name="teacherIds"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t('teachers')}</legend>
              {activeTeachers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noTeachers')}</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeTeachers.map((teacher) => (
                    <label
                      key={teacher.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-brand-soft"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={field.value.includes(teacher.id)}
                        onChange={(event) =>
                          field.onChange(
                            event.target.checked
                              ? [...field.value, teacher.id]
                              : field.value.filter((id) => id !== teacher.id),
                          )
                        }
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{teacher.name}</span>
                        {teacher.specialization ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {teacher.specialization}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          )}
        />
      ) : null}

      <div className="flex justify-end border-t pt-5">
        <div className="w-full sm:w-48">
          <SubmitButton
            pending={isSubmitting}
            label={batch ? common('save') : t('create')}
            pendingLabel={batch ? common('saving') : t('creating')}
          />
        </div>
      </div>
    </form>
  );
}
