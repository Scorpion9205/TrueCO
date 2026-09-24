import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { pickClientMessages } from '@/i18n/client-messages';
import messages from '../../messages/en.json';

/** Renders client components with the English messages the root layout sends to the browser */
export function renderWithIntl(ui: ReactElement, options?: RenderOptions) {
  return render(
    <NextIntlClientProvider
      locale="en"
      timeZone="Asia/Kolkata"
      messages={pickClientMessages(messages)}
    >
      {ui}
    </NextIntlClientProvider>,
    options,
  );
}
