'use client';

import { isApiError } from '@vargly/api-client';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

/** A Zod issue as the API returns it in VALIDATION_ERROR details */
interface ValidationIssue {
  path?: Array<string | number>;
  message?: string;
}

/**
 * Turns an API failure into what the form shows: field errors for server-side validation
 * failures on known fields, and one friendly message for everything else.
 */
export function useAuthError() {
  const t = useTranslations('Auth.errors');

  return useCallback(
    <T extends FieldValues>(
      error: unknown,
      setError?: UseFormSetError<T>,
      fields: ReadonlyArray<Path<T>> = [],
    ): string => {
      if (!isApiError(error)) return t('unexpected');
      if (error.status === 0 || error.status === 502) return t('network');

      if (error.isValidation && setError && Array.isArray(error.details)) {
        let matched = false;
        for (const issue of error.details as ValidationIssue[]) {
          const field = issue.path?.[0];
          if (typeof field === 'string' && (fields as readonly string[]).includes(field)) {
            setError(field as Path<T>, { type: 'server', message: issue.message });
            matched = true;
          }
        }
        if (matched) return t('validation');
      }

      const wait = (error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
      if (error.code === 'RATE_LIMITED' && typeof wait === 'number' && wait > 0) {
        return t('rateLimitedFor', { minutes: Math.ceil(wait / 60) });
      }

      return t.has(error.code as 'unexpected') ? t(error.code as 'unexpected') : t('unexpected');
    },
    [t],
  );
}
