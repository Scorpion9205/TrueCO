'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { QueryError } from '@/components/dashboard/query-error';
import { formatMarks } from '@/components/tests/tests-page';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { hasPassed, useStudentResults } from '@/lib/assessments';
import { formatDate } from '@/lib/format';

/** A student's test results, newest first (shown on their profile) */
export function StudentResults({ studentId }: { studentId: string }) {
  const t = useTranslations('Tests');
  const results = useStudentResults(studentId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('student.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {results.isPending ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : results.isError ? (
          <QueryError error={results.error} onRetry={() => void results.refetch()} />
        ) : results.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('student.empty')}</p>
        ) : (
          <ul className="divide-y">
            {results.data.map((result) => {
              const passed = hasPassed(result.marksObtained, result.isAbsent, result.passingMarks);
              return (
                <li key={result.testId} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/app/tests/${result.testId}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {result.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {result.subject} · {formatDate(result.testDate)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
                    {result.isAbsent ? (
                      <Badge>{t('student.absent')}</Badge>
                    ) : (
                      <span className="font-semibold">
                        {formatMarks(result.marksObtained)}/{formatMarks(result.totalMarks)}
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          {Math.round(result.percentage)}%
                        </span>
                      </span>
                    )}
                    {passed === null || result.isAbsent ? null : (
                      <Badge tone={passed ? 'success' : 'danger'}>
                        {passed ? t('detail.pass') : t('detail.fail')}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
