import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import type { ReactElement } from 'react';
import { pickClientMessages } from '@/i18n/client-messages';
import messages from '../../messages/en.json';

interface Options extends RenderOptions {
  /** Starting query string for pages that keep filters in the URL, e.g. "?q=asha&page=2" */
  searchParams?: string;
  onUrlUpdate?: OnUrlUpdateFunction;
}

/**
 * Renders client components the way the app provides them: the English messages sent to the
 * browser, a fresh query client (no retries, so failures show at once) and URL state
 */
export function renderWithIntl(
  ui: ReactElement,
  { searchParams, onUrlUpdate, ...options }: Options = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider
          locale="en"
          timeZone="Asia/Kolkata"
          messages={pickClientMessages(messages)}
        >
          {ui}
        </NextIntlClientProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>,
    options,
  );
}
