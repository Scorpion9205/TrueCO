'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { SubmitButton } from '@/components/auth/submit-button';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { useBatches } from '@/lib/academics';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { todayInIndia } from '@/lib/dates';
import {
  AUDIENCES,
  endOfDayInIndia,
  expiryDay,
  type Notice,
  type NoticeInput,
  useCreateNotice,
  useUpdateNotice,
} from '@/lib/notices';
import { cn } from '@/lib/utils';
import { useApiError } from '@/lib/use-api-error';

export const MAX_NOTICE_LENGTH = 5000;
const NOTICE_FIELDS = ['title', 'content', 'batchId', 'targetAudience'] as const;

interface NoticeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this notice; omit to post a new one */
  notice?: Notice;
}

export function NoticeFormDialog({ open, onOpenChange, notice }: NoticeFormDialogProps) {
  const t = useTranslations('Notices.form');
  const common = useTranslations('Common');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={notice ? t('editTitle') : t('createTitle')}
      closeLabel={common('close')}
      size="lg"
    >
      {open ? <NoticeForm notice={notice} onDone={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function NoticeForm({ notice, onDone }: { notice?: Notice; onDone: () => void }) {
  const t = useTranslations('Notices');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const user = useSession()?.user;
  const batches = useBatches(can(user, 'batches:read'));
  const create = useCreateNotice();
  const update = useUpdateNotice(notice?.id ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(3, t('form.titleMin')).max(255),
        content: z
          .string()
          .trim()
          .min(5, t('form.contentMin'))
          .max(MAX_NOTICE_LENGTH, t('form.contentMax', { max: MAX_NOTICE_LENGTH })),
        targetAudience: z.enum(AUDIENCES),
        batchId: z.string(),
        isPinned: z.boolean(),
        until: z
          .string()
          // A past day is fine only if it is the one already saved (editing an expired notice)
          .refine(
            (day) => !day || day >= todayInIndia() || day === expiryDay(notice?.expiresAt),
            t('form.untilPast'),
          ),
      }),
    [t, notice?.expiresAt],
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
      title: notice?.title ?? '',
      content: notice?.content ?? '',
      targetAudience: notice?.targetAudience ?? 'ALL',
      batchId: notice?.batchId ?? '',
      isPinned: notice?.isPinned ?? false,
      until: expiryDay(notice?.expiresAt),
    },
  });
  const content = useWatch({ control, name: 'content' });
  const audience = useWatch({ control, name: 'targetAudience' });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const input: NoticeInput = {
      title: values.title,
      content: values.content,
      targetAudience: values.targetAudience,
      batchId: values.batchId || null,
      isPinned: values.isPinned,
      expiresAt: values.until ? endOfDayInIndia(values.until) : null,
    };
    try {
      if (notice) {
        // Send only what changed; an unchanged expiry keeps its exact saved time
        const changes: Partial<NoticeInput> = {};
        if (input.title !== notice.title) changes.title = input.title;
        if (input.content !== notice.content) changes.content = input.content;
        if (input.targetAudience !== notice.targetAudience) {
          changes.targetAudience = input.targetAudience;
        }
        if (input.batchId !== (notice.batchId ?? null)) changes.batchId = input.batchId;
        if (input.isPinned !== notice.isPinned) changes.isPinned = input.isPinned;
        if (values.until !== expiryDay(notice.expiresAt)) changes.expiresAt = input.expiresAt;
        if (Object.keys(changes).length) {
          await update.mutateAsync(changes);
          toast.success(t('form.updated'));
        }
      } else {
        await create.mutateAsync(input);
        toast.success(t('form.posted'));
      }
      onDone();
    } catch (error) {
      setFormError(describeError(error, setError, NOTICE_FIELDS));
    }
  });

  const activeBatches = (batches.data ?? []).filter(
    (batch) => batch.isActive || batch.id === notice?.batchId,
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <FormField id="notice-title" label={t('form.title')} error={errors.title?.message}>
        <Input autoComplete="off" autoFocus maxLength={255} {...register('title')} />
      </FormField>

      <FormField
        id="notice-content"
        label={t('form.content')}
        hint={t('form.contentCount', { count: content.length, max: MAX_NOTICE_LENGTH })}
        error={errors.content?.message}
      >
        <Textarea rows={6} {...register('content')} />
      </FormField>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('form.audience')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AUDIENCES.map((value) => (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                audience === value
                  ? 'border-primary bg-brand-soft text-accent-foreground'
                  : 'hover:bg-muted',
              )}
            >
              <input
                type="radio"
                value={value}
                className="sr-only"
                {...register('targetAudience')}
              />
              {t(`audience.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {batches.data ? (
          <FormField id="notice-batch" label={t('form.batch')} error={errors.batchId?.message}>
            <Select {...register('batchId')}>
              <option value="">{t('wholeInstitute')}</option>
              {activeBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}
        <FormField
          id="notice-until"
          label={`${t('form.until')} (${common('optional')})`}
          hint={t('form.untilHint')}
          error={errors.until?.message}
        >
          <Input type="date" min={todayInIndia()} {...register('until')} />
        </FormField>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          {...register('isPinned')}
        />
        <span>
          <span className="font-medium">{t('form.pin')}</span>
          <span className="block text-muted-foreground">{t('form.pinHint')}</span>
        </span>
      </label>

      {!notice ? <Alert>{t('form.whatsappHint')}</Alert> : null}

      <div className="flex justify-end border-t pt-5">
        <div className="w-full sm:w-48">
          <SubmitButton
            pending={isSubmitting}
            label={notice ? common('save') : t('form.post')}
            pendingLabel={notice ? common('saving') : t('form.posting')}
          />
        </div>
      </div>
    </form>
  );
}
