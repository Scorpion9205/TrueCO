'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { APP_HOME } from '@/lib/auth/redirect';
import { register as registerInstitute } from '@/lib/auth/session';
import type { RegisterInput } from '@/lib/auth/types';
import { useAuthError } from '@/lib/auth/use-auth-error';
import { normalisePhone, PHONE_PATTERN } from '@/lib/phone';
import { SubmitButton } from './submit-button';

/** "Sharma Classes, Kota" -> "sharma-classes-kota" (the API allows a-z, 0-9, "-" and "_") */
const SERVER_FIELDS = [
  'ownerName',
  'ownerEmail',
  'ownerPhone',
  'ownerPassword',
  'coachingName',
  'city',
  'phone',
  'email',
] as const;

export function SignupForm({ defaultEmail }: { defaultEmail?: string }) {
  const t = useTranslations('Auth');
  const router = useRouter();
  const describeError = useAuthError();
  const [formError, setFormError] = useState<string | null>(null);
  // Suggest the code from the name until the owner types their own

  const schema = useMemo(() => {
    const required = t('validation.required');
    const email = z.string().trim().min(1, required).email(t('validation.email'));
    const phone = z
      .string()
      .transform(normalisePhone)
      .refine((v) => PHONE_PATTERN.test(v), t('validation.phone'));
    return z
      .object({
        ownerName: z.string().trim().min(2, t('validation.nameMin')),
        ownerEmail: email,
        ownerPhone: phone,
        ownerPassword: z.string().min(8, t('validation.passwordMin')),
        coachingName: z.string().trim().min(2, t('validation.nameMin')),
        city: z.string().trim(),
        sameContact: z.boolean(),
        phone: z.string(),
        email: z.string(),
      })
      .superRefine((values, ctx) => {
        if (values.sameContact) return;
        if (!PHONE_PATTERN.test(normalisePhone(values.phone))) {
          ctx.addIssue({ code: 'custom', path: ['phone'], message: t('validation.phone') });
        }
        if (!email.safeParse(values.email).success) {
          ctx.addIssue({ code: 'custom', path: ['email'], message: t('validation.email') });
        }
      });
  }, [t]);
  type FormIn = z.input<typeof schema>;
  type FormOut = z.output<typeof schema>;

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      ownerName: '',
      ownerEmail: defaultEmail ?? '',
      ownerPhone: '',
      ownerPassword: '',
      coachingName: '',
      city: '',
      sameContact: true,
      phone: '',
      email: '',
    },
  });
  const sameContact = useWatch({ control, name: 'sameContact' });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const input: RegisterInput = {
      ownerName: values.ownerName,
      ownerEmail: values.ownerEmail,
      ownerPhone: values.ownerPhone,
      ownerPassword: values.ownerPassword,
      coachingName: values.coachingName,
      city: values.city || undefined,
      phone: values.sameContact ? values.ownerPhone : normalisePhone(values.phone),
      email: values.sameContact ? values.ownerEmail : values.email.trim(),
    };
    try {
      const result = await registerInstitute(input);
      if ('accessToken' in result) {
        router.replace(APP_HOME);
        router.refresh();
      } else {
        const params = new URLSearchParams({ notice: 'registered', email: input.ownerEmail });
        router.replace(`/login?${params}`);
      }
    } catch (error) {
      setFormError(describeError(error, setError, SERVER_FIELDS));
    }
  });

  const passwordLabels = {
    showLabel: t('fields.showPassword'),
    hideLabel: t('fields.hidePassword'),
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-5 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t('signup.aboutYou')}
        </legend>
        <FormField id="ownerName" label={t('fields.ownerName')} error={errors.ownerName?.message}>
          <Input autoComplete="name" autoFocus {...register('ownerName')} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="ownerEmail"
            label={t('fields.ownerEmail')}
            error={errors.ownerEmail?.message}
          >
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              {...register('ownerEmail')}
            />
          </FormField>
          <FormField
            id="ownerPhone"
            label={t('fields.ownerPhone')}
            error={errors.ownerPhone?.message}
          >
            <Input type="tel" autoComplete="tel" inputMode="tel" {...register('ownerPhone')} />
          </FormField>
        </div>
        <FormField
          id="ownerPassword"
          label={t('fields.password')}
          hint={t('fields.passwordHint')}
          error={errors.ownerPassword?.message}
        >
          <PasswordInput
            autoComplete="new-password"
            {...passwordLabels}
            {...register('ownerPassword')}
          />
        </FormField>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-5 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t('signup.aboutInstitute')}
        </legend>
        <FormField
          id="coachingName"
          label={t('fields.coachingName')}
          error={errors.coachingName?.message}
        >
          <Input autoComplete="organization" {...register('coachingName')} />
        </FormField>
          <FormField id="city" label={t('fields.city')} error={errors.city?.message}>
            <Input autoComplete="address-level2" {...register('city')} />
          </FormField>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-primary"
            {...register('sameContact')}
          />
          {t('fields.sameContact')}
        </label>

        {sameContact ? null : (
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="phone" label={t('fields.phone')} error={errors.phone?.message}>
              <Input type="tel" autoComplete="tel" inputMode="tel" {...register('phone')} />
            </FormField>
            <FormField id="email" label={t('fields.instituteEmail')} error={errors.email?.message}>
              <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
            </FormField>
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-4">
        <SubmitButton
          pending={isSubmitting}
          label={t('signup.submit')}
          pendingLabel={t('signup.submitting')}
        />
        <p className="text-center text-xs text-muted-foreground">{t('signup.terms')}</p>
        <p className="text-center text-sm text-muted-foreground">
          {t('signup.haveAccount')}{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            {t('signup.signIn')}
          </Link>
        </p>
      </div>
    </form>
  );
}
