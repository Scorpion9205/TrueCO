'use client';

import { CalendarClock, Megaphone, Pencil, Pin, PinOff, Plus, Trash2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { parseAsBoolean, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useState } from 'react';
import { QueryError } from '@/components/dashboard/query-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { toast } from '@/components/ui/toaster';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { formatDate } from '@/lib/format';
import {
  AUDIENCES,
  isExpired,
  type Notice,
  useDeleteNotice,
  useNotices,
  useUpdateNotice,
} from '@/lib/notices';
import { cn } from '@/lib/utils';
import { useApiError } from '@/lib/use-api-error';

// Forms are left out of the page's first download and load just after it
const NoticeFormDialog = dynamic(() =>
  import('./notice-form-dialog').then((m) => m.NoticeFormDialog),
);

const AUDIENCE_FILTERS = ['any', ...AUDIENCES.filter((value) => value !== 'ALL')] as const;

export function NoticesPage() {
  const t = useTranslations('Notices');
  const user = useSession()?.user;
  const canManage = can(user, 'notices:manage');
  const [posting, setPosting] = useState(false);
  const [{ audience, expired }, setParams] = useQueryStates({
    audience: parseAsStringLiteral(AUDIENCE_FILTERS).withDefault('any'),
    expired: parseAsBoolean.withDefault(false),
  });
  // Staff who only read notices see what is meant for teachers (and for everyone)
  const notices = useNotices(
    canManage
      ? { audience: audience === 'any' ? undefined : audience, includeExpired: expired }
      : { audience: 'TEACHERS' },
  );

  const postButton = canManage ? (
    <Button onClick={() => setPosting(true)}>
      <Plus aria-hidden />
      {t('add')}
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} actions={postButton} />

      {canManage ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="sm:w-56">
            <Select
              aria-label={t('audienceFilter')}
              value={audience}
              onChange={(event) =>
                void setParams({
                  audience: event.target.value as (typeof AUDIENCE_FILTERS)[number],
                })
              }
            >
              {AUDIENCE_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {t(`filter.${value}`)}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={expired}
              onChange={(event) => void setParams({ expired: event.target.checked || null })}
            />
            {t('showExpired')}
          </label>
        </div>
      ) : null}

      {notices.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : notices.isError ? (
        <QueryError error={notices.error} onRetry={() => void notices.refetch()} />
      ) : notices.data.length === 0 ? (
        <StatePanel icon={<Megaphone className="size-5" aria-hidden />} title={t('empty.title')}>
          <p>{canManage ? t('empty.body') : t('empty.staffBody')}</p>
          {postButton ? <div className="mt-2">{postButton}</div> : null}
        </StatePanel>
      ) : (
        <ul className="flex flex-col gap-4">
          {notices.data.map((notice) => (
            <li key={notice.id}>
              <NoticeCard notice={notice} canManage={canManage} />
            </li>
          ))}
        </ul>
      )}

      <NoticeFormDialog open={posting} onOpenChange={setPosting} />
    </div>
  );
}

function NoticeCard({ notice, canManage }: { notice: Notice; canManage: boolean }) {
  const t = useTranslations('Notices');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const update = useUpdateNotice(notice.id);
  const remove = useDeleteNotice();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const expired = isExpired(notice);

  const togglePin = async () => {
    try {
      await update.mutateAsync({ isPinned: !notice.isPinned });
      toast.success(t(notice.isPinned ? 'unpinned' : 'pinned'));
    } catch (error) {
      toast.error(describeError(error));
    }
  };

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(notice.id);
      toast.success(t('deleted'));
      setDeleting(false);
    } catch (error) {
      toast.error(describeError(error));
    }
  };

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card',
        notice.isPinned && 'border-primary/40',
        expired && 'opacity-70',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {notice.isPinned ? (
          <Badge tone="brand">
            <Pin aria-hidden />
            {t('pinnedBadge')}
          </Badge>
        ) : null}
        <Badge tone="info">
          <Users aria-hidden />
          {t(`audience.${notice.targetAudience}`)}
        </Badge>
        <Badge>{notice.batchName ?? t('wholeInstitute')}</Badge>
        {expired ? <Badge tone="warning">{t('expiredBadge')}</Badge> : null}
      </div>

      <h2 className="text-lg font-bold break-words">{notice.title}</h2>
      <p className="text-sm break-words whitespace-pre-line text-foreground/90">{notice.content}</p>

      <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{t('postedOn', { date: formatDate(notice.createdAt) })}</span>
          {notice.expiresAt ? (
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3.5" aria-hidden />
              {t(expired ? 'endedOn' : 'showingUntil', { date: formatDate(notice.expiresAt) })}
            </span>
          ) : null}
        </p>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={update.isPending}
              onClick={() => void togglePin()}
            >
              {notice.isPinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
              {notice.isPinned ? t('unpin') : t('pin')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={`${common('edit')}: ${notice.title}`}
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden />
              {common('edit')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              aria-label={`${t('delete')}: ${notice.title}`}
              onClick={() => setDeleting(true)}
            >
              <Trash2 aria-hidden />
              {t('delete')}
            </Button>
          </div>
        ) : null}
      </div>

      {canManage ? (
        <>
          <NoticeFormDialog open={editing} onOpenChange={setEditing} notice={notice} />
          <ConfirmDialog
            open={deleting}
            onOpenChange={setDeleting}
            title={t('deleteTitle', { title: notice.title })}
            description={t('deleteBody')}
            confirmLabel={t('delete')}
            cancelLabel={common('cancel')}
            pending={remove.isPending}
            destructive
            onConfirm={() => void confirmDelete()}
          />
        </>
      ) : null}
    </article>
  );
}
