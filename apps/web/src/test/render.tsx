import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { pickClientMessages } from '@/i18n/client-messages';
import messages from '../../messages/en.json';

/**
 * Renders client components the way the root layout provides them: the English messages sent to
 * the browser and a fresh query client (no retries, so failures show at once)
 */
export function renderWithIntl(ui: ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale="en"
        timeZone="Asia/Kolkata"
        messages={pickClientMessages(messages)}
      >
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
    options,
  );
}
