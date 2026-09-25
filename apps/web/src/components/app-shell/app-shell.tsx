'use client';

import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog } from 'radix-ui';
import { type ReactNode, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCoachingProfile } from '@/lib/queries';
import { SectionGuard } from './section-guard';
import { SidebarNav } from './sidebar-nav';
import { SubscriptionBanner } from './subscription-banner';
import { UserMenu } from './user-menu';

/**
 * Signed-in layout: a fixed sidebar on large screens, a top bar with a slide-in menu on phones
 * and tablets, and the subscription banner above the page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('Shell');
  const [menuOpen, setMenuOpen] = useState(false);
  const coaching = useCoachingProfile();

  const institute = coaching.data ? (
    <p className="truncate text-sm font-semibold" title={coaching.data.name}>
      {coaching.data.name}
    </p>
  ) : coaching.isPending ? (
    <Skeleton className="h-4 w-32" />
  ) : null;

  return (
    <div className="min-h-dvh bg-muted/40">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        {t('skip')}
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background lg:flex print:hidden">
        <div className="flex h-16 shrink-0 items-center px-6">
          <Logo href="/app" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <SidebarNav />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-64 print:pl-0">
        {coaching.data ? (
          <div className="print:hidden">
            <SubscriptionBanner subscription={coaching.data.subscription} />
          </div>
        ) : null}

        <header className="sticky top-0 z-20 flex h-16 print:hidden shrink-0 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog.Trigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 lg:hidden"
                aria-label={t('openMenu')}
              >
                <Menu className="size-5!" />
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/30 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 lg:hidden" />
              <Dialog.Content
                aria-describedby={undefined}
                className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-background shadow-float data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left lg:hidden"
              >
                <Dialog.Title className="sr-only">{t('menu')}</Dialog.Title>
                <div className="flex h-16 shrink-0 items-center justify-between px-4">
                  <Logo href={null} />
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon" aria-label={t('closeMenu')}>
                      <X className="size-5!" />
                    </Button>
                  </Dialog.Close>
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-6">
                  <SidebarNav onNavigate={() => setMenuOpen(false)} />
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <div className="lg:hidden">
            <Logo href="/app" className="text-lg" />
          </div>
          <div className="hidden min-w-0 flex-1 lg:block">{institute}</div>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </header>

        <main id="content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">
          <div className="mx-auto w-full max-w-7xl">
            <SectionGuard>{children}</SectionGuard>
          </div>
        </main>
      </div>
    </div>
  );
}
