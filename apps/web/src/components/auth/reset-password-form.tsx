'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { FormField } from '@/components/ui/form-field';
import { PasswordInput } from '@/components/ui/password-input';
import { publicApi } from '@/lib/api';
import { useAuthError } from '@/lib/auth/use-auth-error';
import { SubmitButton } from './submit-button';

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('Auth');
  const router = useRouter();
  const describeError = useAuthError();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          newPassword: z.string().min(8, t('validation.passwordMin')),
          confirmPassword: z.string(),
        })
        .refine((v) => v.newPassword === v.confirmPassword, {
          path: ['confirmPassword'],
          message: t('validation.passwordsMatch'),
        }),
    [t],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    setFormError(null);
    try {
      await publicApi.post('/auth/reset-password', { token, newPassword });
      router.replace('/login?notice=reset');
    } catch (error) {
      const message = describeError(error, setError, ['newPassword']);
      setFormError(message);
    }
  });

  const labels = { showLabel: t('fields.showPassword'), hideLabel: t('fields.hidePassword') };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <FormField
        id="newPassword"
        label={t('fields.newPassword')}
        hint={t('fields.passwordHint')}
        error={errors.newPassword?.message}
      >
        <PasswordInput
          autoComplete="new-password"
          autoFocus
          {...labels}
          {...register('newPassword')}
        />
      </FormField>
      <FormField
        id="confirmPassword"
        label={t('fields.confirmPassword')}
        error={errors.confirmPassword?.message}
      >
        <PasswordInput autoComplete="new-password" {...labels} {...register('confirmPassword')} />
      </FormField>
      <SubmitButton
        pending={isSubmitting}
        label={t('reset.submit')}
        pendingLabel={t('reset.submitting')}
      />
    </form>
  );
}
