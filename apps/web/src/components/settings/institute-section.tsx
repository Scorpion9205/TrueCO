'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SubmitButton } from '@/components/auth/submit-button';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { changedFields } from '@/lib/academics';
import type { CoachingProfile } from '@/lib/api-types';
import { isValidPhone, normalisePhone } from '@/lib/phone';
import { type InstituteUpdate, useUpdateInstitute } from '@/lib/settings';
import { useApiError } from '@/lib/use-api-error';
import { SettingsCard } from './settings-card';

const FIELDS = ['name', 'phone', 'email', 'address', 'city', 'state'] as const;

export function InstituteSection({
  profile,
  canManage,
}: {
  profile: CoachingProfile;
  canManage: boolean;
}) {
  const t = useTranslations('Settings.institute');
  const v = useTranslations('Auth.validation');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const update = useUpdateInstitute();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, v('nameMin')).max(255),
        phone: z.string().refine(isValidPhone, v('phone')),
        email: z.string().trim().email(v('email')),
        address: z.string().trim().max(500),
        city: z.string().trim().max(100),
        state: z.string().trim().max(100),
      }),
    [v],
  );
  type Values = z.infer<typeof schema>;
  const saved: Values = {
    name: profile.name,
    phone: profile.phone,
    email: profile.email,
    address: profile.address ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
  };

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({ resolver: zodResolver(schema), values: saved });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const changes = changedFields(saved, {
      ...values,
      phone: normalisePhone(values.phone),
      email: values.email.toLowerCase(),
    });
    if (Object.keys(changes).length === 0) return;
    try {
      const updated = await update.mutateAsync(changes as InstituteUpdate);
      reset({ ...values, email: updated.email, phone: updated.phone });
      toast.success(t('saved'));
    } catch (error) {
      setFormError(describeError(error, setError, FIELDS));
    }
  });

  return (
    <SettingsCard title={t('title')} description={t('description')}>
      <CodeRow code={profile.code} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <fieldset disabled={!canManage} className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="institute-name"
            label={t('name')}
            error={errors.name?.message}
            className="sm:col-span-2"
          >
            <Input autoComplete="organization" {...register('name')} />
          </FormField>
          <FormField id="institute-phone" label={t('phone')} error={errors.phone?.message}>
            <Input type="tel" inputMode="tel" autoComplete="tel" {...register('phone')} />
          </FormField>
          <FormField id="institute-email" label={t('email')} error={errors.email?.message}>
            <Input type="email" inputMode="email" autoComplete="email" {...register('email')} />
          </FormField>
          <FormField
            id="institute-address"
            label={`${t('address')} (${common('optional')})`}
            error={errors.address?.message}
            className="sm:col-span-2"
          >
            <Input autoComplete="street-address" {...register('address')} />
          </FormField>
          <FormField
            id="institute-city"
            label={`${t('city')} (${common('optional')})`}
            error={errors.city?.message}
          >
            <Input autoComplete="address-level2" {...register('city')} />
          </FormField>
          <FormField
            id="institute-state"
            label={`${t('state')} (${common('optional')})`}
            error={errors.state?.message}
          >
            <Input autoComplete="address-level1" {...register('state')} />
          </FormField>
        </fieldset>
        {canManage ? (
          <div className="flex justify-end">
            <div className="w-full sm:w-40">
              <SubmitButton
                pending={isSubmitting}
                disabled={!isDirty}
                label={t('save')}
                pendingLabel={common('saving')}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('readOnly')}</p>
        )}
      </form>
    </SettingsCard>
  );
}

function CodeRow({ code }: { code: string }) {
  const t = useTranslations('Settings.institute');
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      toast.error(t('copyFailed'));
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{t('code')}</p>
        <p className="font-mono text-lg font-bold">{code}</p>
        <p className="text-xs text-muted-foreground">{t('codeHint')}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => void copy()} className="self-start">
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? t('copied') : t('copy')}
      </Button>
    </div>
  );
}
