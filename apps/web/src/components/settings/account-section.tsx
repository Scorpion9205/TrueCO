'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SubmitButton } from '@/components/auth/submit-button';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { PasswordInput } from '@/components/ui/password-input';
import { toast } from '@/components/ui/toaster';
import { signOut } from '@/lib/auth/session';
import type { SessionUser } from '@/lib/auth/types';
import { useChangePassword, useSignOutEverywhere } from '@/lib/settings';
import { useApiError } from '@/lib/use-api-error';
import { SettingsCard } from './settings-card';

export function AccountSection({ user }: { user: SessionUser }) {
  const t = useTranslations('Settings.account');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const everywhere = useSignOutEverywhere();
  const [confirming, setConfirming] = useState(false);

  const signOutEverywhere = async () => {
    try {
      await everywhere.mutateAsync();
      await signOut('signedOutEverywhere');
    } catch (error) {
      toast.error(describeError(error));
      setConfirming(false);
    }
  };

  return (
    <SettingsCard title={t('title')} description={t('description')}>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{t('name')}</dt>
          <dd className="font-medium">{user.name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('email')}</dt>
          <dd className="font-medium break-all">{user.email}</dd>
        </div>
      </dl>

      <ChangePassword />

      <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">{t('everywhere')}</p>
          <p className="text-sm text-muted-foreground">{t('everywhereHint')}</p>
        </div>
        <Button variant="outline" className="self-start" onClick={() => setConfirming(true)}>
          <LogOut aria-hidden />
          {t('everywhereAction')}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('everywhereTitle')}
        description={t('everywhereBody')}
        confirmLabel={t('everywhereAction')}
        cancelLabel={common('cancel')}
        pending={everywhere.isPending}
        onConfirm={() => void signOutEverywhere()}
      />
    </SettingsCard>
  );
}

function ChangePassword() {
  const t = useTranslations('Settings.account');
  const v = useTranslations('Auth.validation');
  const auth = useTranslations('Auth.fields');
  const describeError = useApiError();
  const change = useChangePassword();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, v('required')),
          newPassword: z.string().min(8, v('passwordMin')).max(128),
          confirmPassword: z.string(),
        })
        .refine((values) => values.newPassword === values.confirmPassword, {
          path: ['confirmPassword'],
          message: v('passwordsMatch'),
        })
        .refine((values) => values.newPassword !== values.currentPassword, {
          path: ['newPassword'],
          message: t('samePassword'),
        }),
    [v, t],
  );
  type Values = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFormError(null);
    try {
      await change.mutateAsync({ currentPassword, newPassword });
    } catch (error) {
      setFormError(describeError(error, setError, ['currentPassword', 'newPassword']));
      return;
    }
    // Every session was ended with the old password, this one included
    await signOut('passwordChanged');
  });

  const toggle = { showLabel: auth('showPassword'), hideLabel: auth('hidePassword') };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 border-t pt-5">
      <div>
        <p className="font-medium">{t('password')}</p>
        <p className="text-sm text-muted-foreground">{t('passwordHint')}</p>
      </div>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          id="current-password"
          label={t('currentPassword')}
          error={errors.currentPassword?.message}
        >
          <PasswordInput
            autoComplete="current-password"
            {...toggle}
            {...register('currentPassword')}
          />
        </FormField>
        <FormField id="new-password" label={t('newPassword')} error={errors.newPassword?.message}>
          <PasswordInput autoComplete="new-password" {...toggle} {...register('newPassword')} />
        </FormField>
        <FormField
          id="confirm-password"
          label={t('confirmPassword')}
          error={errors.confirmPassword?.message}
        >
          <PasswordInput autoComplete="new-password" {...toggle} {...register('confirmPassword')} />
        </FormField>
      </div>
      <div className="flex justify-end">
        <div className="w-full sm:w-56">
          <SubmitButton
            pending={isSubmitting}
            label={t('changePassword')}
            pendingLabel={t('changingPassword')}
          />
        </div>
      </div>
    </form>
  );
}
