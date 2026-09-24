import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { pickClientMessages } from '@/i18n/client-messages';
import { SITE_URL } from '@/lib/site';
import { Providers } from './providers';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('title'), template: '%s · TrueCO' },
    description: t('description'),
    openGraph: {
      type: 'website',
      siteName: 'TrueCO',
      title: t('title'),
      description: t('description'),
      locale: 'en_IN',
    },
    twitter: { card: 'summary', title: t('title'), description: t('description') },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await getLocale();
  const messages = pickClientMessages(await getMessages());
  return (
    <html lang={locale} className={jakarta.variable}>
      <body className="min-h-dvh font-sans">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
