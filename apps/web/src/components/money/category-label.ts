'use client';

import { useTranslations } from 'next-intl';

/** A category's label when it is one we know; other categories show as typed */
export function useCategoryLabel() {
  const t = useTranslations('Expenses.category');
  return (category: string) => (t.has(category as 'RENT') ? t(category as 'RENT') : category);
}
