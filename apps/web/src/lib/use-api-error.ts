'use client';

import { isApiError } from '@trueco/api-client';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

/** A Zod issue as the API returns it in VALIDATION_ERROR details */
interface ValidationIssue {
  path?: Array<string | number>;
  message?: string;
}

/**
 * Turns a failed API call into a message for the user. Server-side validation failures on the
 * form's own fields are shown on those fields; an unknown code falls back to a generic message
 * (the API's English text is written for developers, not for the institute's staff).
 */
export function useApiError() {
  const t = useTranslations('Common.apiErrors');

  return useCallback(
    <T extends FieldValues>(
      error: unknown,
      setError?: UseFormSetError<T>,
      fields: ReadonlyArray<Path<T>> = [],
    ): string => {
      if (!isApiError(error)) return t('unexpected');
      if (error.status === 0) return t('network');

      if (error.isValidation && setError && Array.isArray(error.details)) {
        for (const issue of error.details as ValidationIssue[]) {
          const field = issue.path?.[0];
          if (typeof field === 'string' && (fields as readonly string[]).includes(field)) {
            setError(field as Path<T>, { type: 'server', message: issue.message });
          }
        }
      }
      if (error.isForbidden) return t('FORBIDDEN');
      if (error.isNotFound) return t('NOT_FOUND');
      return t.has(error.code as 'unexpected') ? t(error.code as 'unexpected') : t('unexpected');
    },
    [t],
  );
}
