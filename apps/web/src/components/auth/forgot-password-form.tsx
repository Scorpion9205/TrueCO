'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { publicApi } from '@/lib/api';
import { useAuthError } from '@/lib/auth/use-auth-error';
import { SubmitButton } from './submit-button';

export function ForgotPasswordForm() {
  const t = useTranslations('Auth');
  const describeError = useAuthError();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().trim().min(1, t('validation.required')).email(t('validation.email')),
        coachingCode: z.string().trim(),
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
    defaultValues: { email: '', coachingCode: '' },
  });

  const onSubmit = handleSubmit(async ({ email, coachingCode }) => {
    setFormError(null);
    try {
      await publicApi.post('/auth/forgot-password', {
        email,
        ...(coachingCode ? { coachingCode: coachingCode.toLowerCase() } : {}),
      });
      // The API replies the same whether or not the account exists, and so does this page
      setSentTo(email);
    } catch (error) {
      setFormError(describeError(error, setError, ['email', 'coachingCode']));
    }
  });

  const back = (
    <Link href="/login" className="text-center text-sm font-semibold text-primary hover:underline">
      {t('forgot.back')}
    </Link>
  );

  if (sentTo) {
    return (
      <div className="flex flex-col gap-6">
        <Alert tone="success">{t('forgot.sent', { email: sentTo })}</Alert>
        {back}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <FormField id="email" label={t('fields.email')} error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          {...register('email')}
        />
      </FormField>
      <FormField
        id="coachingCode"
        label={t('fields.coachingCodeOptional')}
        hint={t('fields.coachingCodeLoginHint')}
        error={errors.coachingCode?.message}
      >
        <Input autoCapitalize="none" spellCheck={false} {...register('coachingCode')} />
      </FormField>
      <SubmitButton
        pending={isSubmitting}
        label={t('forgot.submit')}
        pendingLabel={t('forgot.submitting')}
      />
      {back}
    </form>
  );
}
