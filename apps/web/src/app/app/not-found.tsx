import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { StatePanel } from '@/components/ui/state-panel';

export default async function AppNotFound() {
  const t = await getTranslations('NotFound');
  return (
    <StatePanel icon={<SearchX className="size-5" aria-hidden />} title={t('title')}>
      <p>{t('body')}</p>
      <Button asChild variant="outline" className="mt-2">
        <Link href="/app">{t('dashboard')}</Link>
      </Button>
    </StatePanel>
  );
}
