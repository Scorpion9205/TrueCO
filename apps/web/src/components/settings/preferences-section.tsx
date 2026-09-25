'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { QueryError } from '@/components/dashboard/query-error';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { todayInIndia } from '@/lib/dates';
import {
  financialYearLabel,
  type Preferences,
  preferencesOf,
  RECEIPT_PREFIX_PATTERN,
  useInstituteSettings,
  useUpdatePreferences,
} from '@/lib/settings';
import { cn } from '@/lib/utils';
import { useApiError } from '@/lib/use-api-error';
import { SettingsCard } from './settings-card';

export function PreferencesSection({ canManage }: { canManage: boolean }) {
  const t = useTranslations('Settings.preferences');
  const settings = useInstituteSettings();

  return (
    <SettingsCard title={t('title')} description={t('description')}>
      {settings.isPending ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : settings.isError ? (
        <QueryError error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <Preferences
          // Remount after a save so the inputs start from what was stored
          key={settings.data.updatedAt}
          saved={preferencesOf(settings.data)}
          canManage={canManage}
        />
      )}
    </SettingsCard>
  );
}

function Preferences({ saved, canManage }: { saved: Preferences; canManage: boolean }) {
  const t = useTranslations('Settings.preferences');
  const describeError = useApiError();
  const update = useUpdatePreferences();
  const [prefix, setPrefix] = useState(saved.receiptPrefix);
  const [error, setError] = useState<string | null>(null);
  const cleaned = prefix.trim().toUpperCase();
  const valid = RECEIPT_PREFIX_PATTERN.test(cleaned);
  const example = `${valid ? cleaned : saved.receiptPrefix}/${financialYearLabel(todayInIndia())}/00001`;

  const savePrefix = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || cleaned === saved.receiptPrefix) return;
    setError(null);
    try {
      await update.mutateAsync({ receiptPrefix: cleaned });
      toast.success(t('prefixSaved'));
    } catch (err) {
      setError(describeError(err));
    }
  };

  const toggleWhatsapp = async () => {
    try {
      await update.mutateAsync({ notifications: { whatsappEnabled: !saved.whatsappEnabled } });
      toast.success(t(saved.whatsappEnabled ? 'whatsappOff' : 'whatsappOn'));
    } catch (err) {
      toast.error(describeError(err));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={savePrefix} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <FormField
            id="receipt-prefix"
            label={t('prefix')}
            hint={t('prefixExample', { example })}
            error={error ?? (prefix && !valid ? t('prefixInvalid') : undefined)}
            className="sm:w-64"
          >
            <Input
              value={prefix}
              maxLength={10}
              autoCapitalize="characters"
              className="font-mono uppercase"
              disabled={!canManage}
              onChange={(event) => setPrefix(event.target.value)}
            />
          </FormField>
          {canManage ? (
            <Button
              type="submit"
              variant="outline"
              className="sm:mt-7"
              disabled={!valid || cleaned === saved.receiptPrefix || update.isPending}
            >
              {t('savePrefix')}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{t('prefixNote')}</p>
      </form>

      <div className="flex items-start justify-between gap-4 border-t pt-5">
        <div>
          <p id="whatsapp-label" className="font-medium">
            {t('whatsapp')}
          </p>
          <p id="whatsapp-hint" className="text-sm text-muted-foreground">
            {t('whatsappHint')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={saved.whatsappEnabled}
          aria-labelledby="whatsapp-label"
          aria-describedby="whatsapp-hint"
          disabled={!canManage || update.isPending}
          onClick={() => void toggleWhatsapp()}
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60',
            saved.whatsappEnabled ? 'bg-primary' : 'bg-muted-foreground/30',
          )}
        >
          <span
            className={cn(
              'grid size-5 place-items-center rounded-full bg-background shadow transition-transform',
              saved.whatsappEnabled ? 'translate-x-6' : 'translate-x-1',
            )}
          >
            {update.isPending ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
          </span>
        </button>
      </div>
    </div>
  );
}
