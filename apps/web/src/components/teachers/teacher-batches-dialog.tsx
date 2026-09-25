'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { type Teacher, useAssignTeacher, useBatches } from '@/lib/academics';
import { useRemoveTeacherFromBatch } from '@/lib/teachers';
import { useApiError } from '@/lib/use-api-error';

/** The batches a teacher teaches: the API lets teachers act only on these */
export function TeacherBatchesDialog({
  open,
  onOpenChange,
  teacher,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: Teacher;
}) {
  const t = useTranslations('Teachers.batches');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const batches = useBatches(open);
  const assign = useAssignTeacher();
  const remove = useRemoveTeacherFromBatch();
  const [batchId, setBatchId] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const assigned = teacher.assignedBatches ?? [];
  const available = (batches.data ?? []).filter(
    (batch) => batch.isActive && !assigned.some((item) => item.batchId === batch.id),
  );

  const add = async () => {
    const batch = available.find((item) => item.id === batchId);
    if (!batch) return;
    try {
      await assign.mutateAsync({ batchId, teacherId: teacher.id });
      toast.success(t('added', { name: teacher.name, batch: batch.name }));
      setBatchId('');
    } catch (error) {
      toast.error(describeError(error));
    }
  };

  const drop = async (id: string, name: string) => {
    setRemoving(id);
    try {
      await remove.mutateAsync({ batchId: id, teacherId: teacher.id });
      toast.success(t('removed', { name: teacher.name, batch: name }));
    } catch (error) {
      toast.error(describeError(error));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('title', { name: teacher.name })}
      description={t('body')}
      closeLabel={common('close')}
    >
      <div className="flex flex-col gap-5">
        {assigned.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            {t('none')}
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {assigned.map((batch) => (
              <li key={batch.batchId} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="truncate font-medium">{batch.batchName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removing !== null}
                  aria-label={t('remove', { batch: batch.batchName })}
                  onClick={() => void drop(batch.batchId, batch.batchName)}
                >
                  {removing === batch.batchId ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <X aria-hidden />
                  )}
                  {common('remove')}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {available.length ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="sm:flex-1">
              <Select
                aria-label={t('pick')}
                value={batchId}
                onChange={(event) => setBatchId(event.target.value)}
              >
                <option value="">{t('choose')}</option>
                {available.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.subject ? `${batch.name} · ${batch.subject}` : batch.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              disabled={!batchId || assign.isPending}
              aria-busy={assign.isPending}
              onClick={() => void add()}
            >
              {assign.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Plus aria-hidden />
              )}
              {t('add')}
            </Button>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
