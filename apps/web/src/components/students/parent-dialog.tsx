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
import { useAddParent } from '@/lib/academics';
import { isValidPhone, normalisePhone } from '@/lib/phone';
import { useApiError } from '@/lib/use-api-error';
import { RELATIONS } from './student-form-dialog';

interface ParentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  /** The first parent becomes the primary WhatsApp contact */
  isFirst: boolean;
}

export function ParentDialog({ open, onOpenChange, studentId, isFirst }: ParentDialogProps) {
  const t = useTranslations('Students');
  const common = useTranslations('Common');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('detail.addParent')}
      description={t('form.parentHint')}
      closeLabel={common('close')}
    >
      {open ? (
        <ParentForm studentId={studentId} isFirst={isFirst} onDone={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  );
}

function ParentForm({
  studentId,
  isFirst,
  onDone,
}: {
  studentId: string;
  isFirst: boolean;
  onDone: () => void;
}) {
  const t = useTranslations('Students');
  const v = useTranslations('Auth.validation');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const addParent = useAddParent();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, v('nameMin')).max(255),
        phone: z.string().refine(isValidPhone, v('phone')),
        relation: z.enum(RELATIONS),
      }),
    [v],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', relation: 'FATHER' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await addParent.mutateAsync({
        name: values.name,
        phone: normalisePhone(values.phone),
        relation: values.relation,
        studentId,
        isPrimary: isFirst,
      });
      toast.success(t('detail.parentAdded'));
      onDone();
    } catch (error) {
      setFormError(describeError(error, setError, ['name', 'phone', 'relation']));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <FormField id="parent-name" label={t('form.parentName')} error={errors.name?.message}>
        <Input autoComplete="off" autoFocus {...register('name')} />
      </FormField>
      <FormField id="parent-phone" label={t('form.parentPhone')} error={errors.phone?.message}>
        <Input type="tel" inputMode="tel" autoComplete="off" {...register('phone')} />
      </FormField>
      <FormField id="parent-relation" label={t('form.relation')}>
        <Select {...register('relation')}>
          {RELATIONS.map((relation) => (
            <option key={relation} value={relation}>
              {t(`relation.${relation}`)}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="mt-2">
        <SubmitButton
          pending={isSubmitting}
          label={common('save')}
          pendingLabel={common('saving')}
        />
      </div>
    </form>
  );
}
