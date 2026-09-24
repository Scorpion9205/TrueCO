import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand/logo';
import { CONTACT_EMAIL } from '@/lib/site';
import { visibleNavLinks } from './nav-links';

export async function SiteFooter({ showPricing }: { showPricing: boolean }) {
  const t = await getTranslations('Footer');
  const nav = await getTranslations('Nav');

  const columns = [
    {
      title: t('product'),
      links: visibleNavLinks(showPricing).map((link) => ({
        href: link.href,
        label: nav(link.key),
      })),
    },
    {
      title: t('account'),
      links: [
        { href: '/signup', label: nav('startTrial') },
        { href: '/login', label: nav('signIn') },
      ],
    },
    {
      title: t('contact'),
      links: [{ href: `mailto:${CONTACT_EMAIL}`, label: CONTACT_EMAIL }],
    },
  ];

  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{t('tagline')}</p>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-sm font-semibold">{column.title}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="break-all hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
          {t('rights', { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
