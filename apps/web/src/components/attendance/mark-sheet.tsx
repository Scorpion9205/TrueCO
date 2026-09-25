'use client';

import { CheckCheck, Loader2, MessageCircle, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { QueryError } from '@/components/dashboard/query-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { toast } from '@/components/ui/toaster';
import { fullName, type Student, useBatchStudents } from '@/lib/academics';
import {
  ATTENDANCE_STATUSES,
  type AttendanceSession,
  type AttendanceStatus,
  useAttendanceSessions,
  useMarkAttendance,
} from '@/lib/attendance';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { formatDate } from '@/lib/format';
import { useApiError } from '@/lib/use-api-error';
import { cn } from '@/lib/utils';

interface MarkSheetProps {
  batchId: string;
  /** YYYY-MM-DD */
  date: string;
}

/** Loads the batch's students and any attendance already saved for the day */
export function MarkSheet({ batchId, date }: MarkSheetProps) {
  const t = useTranslations('Attendance');
  const students = useBatchStudents(batchId);
  const sessions = useAttendanceSessions(batchId, date, date);

  if (students.isPending || sessions.isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }
  if (students.isError) {
    return <QueryError error={students.error} onRetry={() => void students.refetch()} />;
  }
  if (sessions.isError) {
    return <QueryError error={sessions.error} onRetry={() => void sessions.refetch()} />;
  }

  const session = sessions.data[0] ?? null;
  if (students.data.length === 0 && !session) {
    return (
      <StatePanel icon={<Users className="size-5" aria-hidden />} title={t('empty.noStudents')}>
        <p>{t('empty.noStudentsBody')}</p>
        <Button asChild variant="outline" className="mt-2">
          <Link href={`/app/batches/${batchId}`}>
            <UserPlus aria-hidden />
            {t('empty.addStudents')}
          </Link>
        </Button>
      </StatePanel>
    );
  }

  // Remount per batch and day, so marks start from what is saved for that day
  return (
    <MarkForm
      key={`${batchId}:${date}:${session?.id ?? 'new'}`}
      batchId={batchId}
      date={date}
      students={students.data}
      session={session}
    />
  );
}

interface RosterEntry {
  studentId: string;
  name: string;
  /** Marked on this day but no longer enrolled in the batch */
  formerMember: boolean;
}

/**
 * Everyone to mark: current members, plus anyone already marked that day who has since left the
 * batch (so a past register stays complete). Sorted by name.
 */
export function buildRoster(students: Student[], session: AttendanceSession | null): RosterEntry[] {
  const roster = new Map<string, RosterEntry>();
  for (const student of students) {
    roster.set(student.id, { studentId: student.id, name: fullName(student), formerMember: false });
  }
  for (const record of session?.records ?? []) {
    if (!roster.has(record.studentId)) {
      roster.set(record.studentId, {
        studentId: record.studentId,
        name: record.studentName,
        formerMember: true,
      });
    }
  }
  return [...roster.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Saved marks, and present for anyone not yet marked (most students attend most days) */
export function initialMarks(
  roster: RosterEntry[],
  session: AttendanceSession | null,
): Record<string, AttendanceStatus> {
  const saved = new Map(session?.records.map((record) => [record.studentId, record.status]));
  return Object.fromEntries(
    roster.map((entry) => [entry.studentId, saved.get(entry.studentId) ?? 'PRESENT']),
  );
}

function MarkForm({
  batchId,
  date,
  students,
  session,
}: {
  batchId: string;
  date: string;
  students: Student[];
  session: AttendanceSession | null;
}) {
  const t = useTranslations('Attendance');
  const describeError = useApiError();
  const canMark = can(useSession()?.user, 'attendance:mark');
  const mark = useMarkAttendance();

  const roster = useMemo(() => buildRoster(students, session), [students, session]);
  const baseline = useMemo(() => initialMarks(roster, session), [roster, session]);
  const [marks, setMarks] = useState(baseline);

  const dirty =
    !session || roster.some((entry) => marks[entry.studentId] !== baseline[entry.studentId]);
  const counts = Object.fromEntries(
    ATTENDANCE_STATUSES.map((status) => [
      status,
      roster.filter((entry) => marks[entry.studentId] === status).length,
    ]),
  ) as Record<AttendanceStatus, number>;

  // Warn before leaving the page with marks that were changed but not saved
  const unsaved = Boolean(session) && dirty;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const save = async () => {
    try {
      await mark.mutateAsync({
        batchId,
        sessionDate: date,
        records: roster.map((entry) => ({
          studentId: entry.studentId,
          status: marks[entry.studentId] ?? 'PRESENT',
        })),
      });
      toast.success(t('savedToast', { date: formatDate(date) }));
    } catch (error) {
      toast.error(describeError(error));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone={session ? 'success' : 'neutral'}>{session ? t('saved') : t('notSaved')}</Badge>
        {canMark ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setMarks(Object.fromEntries(roster.map((entry) => [entry.studentId, 'PRESENT'])))
            }
          >
            <CheckCheck aria-hidden />
            {t('markAll')}
          </Button>
        ) : null}
      </div>

      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
        {roster.map((entry) => (
          <li
            key={entry.studentId}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{entry.name}</p>
              {entry.formerMember ? (
                <p className="text-xs text-muted-foreground">{t('notEnrolled')}</p>
              ) : null}
            </div>
            <StatusPicker
              name={entry.name}
              value={marks[entry.studentId] ?? 'PRESENT'}
              disabled={!canMark}
              onChange={(status) =>
                setMarks((current) => ({ ...current, [entry.studentId]: status }))
              }
            />
          </li>
        ))}
      </ul>

      {/* Stays in view while scrolling a long register */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:border sm:shadow-float">
        <div className="text-sm">
          <p className="font-semibold tabular-nums" aria-live="polite">
            {t('summary', {
              present: counts.PRESENT,
              absent: counts.ABSENT,
              late: counts.LATE,
              excused: counts.EXCUSED,
            })}
          </p>
          {counts.ABSENT > 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageCircle className="size-3.5 text-whatsapp" aria-hidden />
              {t('parentsNotified')}
            </p>
          ) : null}
        </div>
        {canMark ? (
          <div className="flex items-center gap-3">
            {unsaved ? <span className="text-xs text-warning">{t('unsaved')}</span> : null}
            <Button
              size="lg"
              className="w-full sm:w-auto"
              disabled={mark.isPending || (Boolean(session) && !dirty)}
              aria-busy={mark.isPending}
              onClick={() => void save()}
            >
              {mark.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {mark.isPending ? t('saving') : session ? t('update') : t('save')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  PRESENT: 'aria-pressed:border-success aria-pressed:bg-success aria-pressed:text-background',
  ABSENT: 'aria-pressed:border-destructive aria-pressed:bg-destructive aria-pressed:text-background',
  LATE: 'aria-pressed:border-warning aria-pressed:bg-warning aria-pressed:text-background',
  EXCUSED: 'aria-pressed:border-info aria-pressed:bg-info aria-pressed:text-background',
};

/** Four large toggle buttons; the full word on wider screens, a letter on phones */
function StatusPicker({
  name,
  value,
  disabled,
  onChange,
}: {
  name: string;
  value: AttendanceStatus;
  disabled: boolean;
  onChange: (status: AttendanceStatus) => void;
}) {
  const t = useTranslations('Attendance');
  return (
    <div
      role="group"
      aria-label={t('statusFor', { name })}
      className="grid grid-cols-4 gap-1.5 sm:flex"
    >
      {ATTENDANCE_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          aria-pressed={value === status}
          disabled={disabled}
          onClick={() => onChange(status)}
          className={cn(
            'h-10 rounded-lg border border-input px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-20',
            STATUS_STYLES[status],
          )}
        >
          <span aria-hidden className="sm:hidden">
            {t(`short.${status}`)}
          </span>
          <span className="sr-only sm:not-sr-only">{t(`status.${status}`)}</span>
        </button>
      ))}
    </div>
  );
}
