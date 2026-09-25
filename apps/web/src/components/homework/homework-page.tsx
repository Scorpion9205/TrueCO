'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, ExternalLink, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { BatchScope } from '@/components/academics/batch-scope';
import { SubmitButton } from '@/components/auth/submit-button';
import { QueryError } from '@/components/dashboard/query-error';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { changedFields } from '@/lib/academics';
import {
  type Homework,
  type HomeworkUpdate,
  useBatchHomework,
  useCreateHomework,
  useDeleteHomework,
  useUpdateHomework,
} from '@/lib/assessments';
import { addDays, toDay } from '@/lib/attendance';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { todayInIndia } from '@/lib/dates';
import { formatDate } from '@/lib/format';
import type { TeachingBatch } from '@/lib/teaching-batches';
import { useApiError } from '@/lib/use-api-error';

export type DueStatus = 'overdue' | 'today' | 'tomorrow' | 'upcoming';

export function dueStatus(dueDay: string, today: string = todayInIndia()): DueStatus {
  if (dueDay < today) return 'overdue';
  if (dueDay === today) return 'today';
  if (dueDay === addDays(today, 1)) return 'tomorrow';
  return 'upcoming';
}

const DUE_TONES = {
  overdue: 'neutral',
  today: 'danger',
  tomorrow: 'warning',
  upcoming: 'info',
} as const;

export function HomeworkPage() {
  const t = useTranslations('Homework');
  const canCreate = can(useSession()?.user, 'homework:create');
  const [creatingFor, setCreatingFor] = useState<TeachingBatch | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} />
      <BatchScope
        actions={(batch) =>
          canCreate ? (
            <Button onClick={() => setCreatingFor(batch)}>
              <Plus aria-hidden />
              {t('add')}
            </Button>
          ) : null
        }
      >
        {(batch) => (
          <HomeworkList
            batch={batch}
            onCreate={canCreate ? () => setCreatingFor(batch) : undefined}
          />
        )}
      </BatchScope>
      <HomeworkDialog
        open={creatingFor !== null}
        onOpenChange={(open) => !open && setCreatingFor(null)}
        batch={creatingFor ?? undefined}
      />
    </div>
  );
}

function HomeworkList({ batch, onCreate }: { batch: TeachingBatch; onCreate?: () => void }) {
  const t = useTranslations('Homework');
  const homework = useBatchHomework(batch.id);
  const today = todayInIndia();

  if (homework.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }
  if (homework.isError) {
    return <QueryError error={homework.error} onRetry={() => void homework.refetch()} />;
  }
  if (homework.data.length === 0) {
    return (
      <StatePanel icon={<BookOpen className="size-5" aria-hidden />} title={t('empty.title')}>
        <p>{t('empty.body')}</p>
        {onCreate ? (
          <Button className="mt-2" onClick={onCreate}>
            <Plus aria-hidden />
            {t('add')}
          </Button>
        ) : null}
      </StatePanel>
    );
  }

  // Current work soonest first; past work most recent first
  const byDue = [...homework.data].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const current = byDue.filter((item) => toDay(item.dueDate) >= today);
  const past = byDue.filter((item) => toDay(item.dueDate) < today).reverse();

  return (
    <div className="flex flex-col gap-8">
      {[
        ['upcoming', current],
        ['past', past],
      ].map(([key, items]) =>
        (items as Homework[]).length ? (
          <section key={key as string} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {t(key as 'upcoming' | 'past')}
            </h2>
            <ul className="flex flex-col gap-3">
              {(items as Homework[]).map((item) => (
                <li key={item.id}>
                  <HomeworkCard homework={item} batch={batch} />
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}

function HomeworkCard({ homework, batch }: { homework: Homework; batch: TeachingBatch }) {
  const t = useTranslations('Homework');
  const common = useTranslations('Common');
  const user = useSession()?.user;
  const describeError = useApiError();
  const remove = useDeleteHomework();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const day = toDay(homework.dueDate);
  const status = dueStatus(day);

  const deleteHomework = async () => {
    try {
      await remove.mutateAsync(homework.id);
      toast.success(t('deleted'));
    } catch (error) {
      toast.error(describeError(error));
    }
    setConfirmDelete(false);
  };

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold break-words">{homework.title}</h3>
          <p className="text-sm text-muted-foreground">{t('due', { date: formatDate(day) })}</p>
        </div>
        <Badge tone={DUE_TONES[status]}>{t(`status.${status}`)}</Badge>
      </div>
      <p className="text-sm whitespace-pre-line break-words">{homework.description}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {homework.attachmentUrl ? (
          <a
            href={homework.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="size-4" aria-hidden />
            {t('attachment')}
          </a>
        ) : (
          <span />
        )}
        <div className="flex gap-1">
          {can(user, 'homework:update') ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              {t('edit')}
            </Button>
          ) : null}
          {can(user, 'homework:delete') ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden />
              {t('delete')}
            </Button>
          ) : null}
        </div>
      </div>

      <HomeworkDialog open={editing} onOpenChange={setEditing} batch={batch} homework={homework} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('deleteTitle', { name: homework.title })}
        description={t('deleteBody')}
        confirmLabel={t('delete')}
        cancelLabel={common('cancel')}
        onConfirm={() => void deleteHomework()}
        pending={remove.isPending}
        destructive
      />
    </article>
  );
}

function HomeworkDialog({
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
