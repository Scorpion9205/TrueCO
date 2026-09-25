'use client';

import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getSessionEnd, refreshSession } from '@/lib/auth/session';
import { useSession } from '@/lib/auth/use-session';

/**
 * Renders the signed-in app once there is a session. After a page load the access token is
 * gone from memory, so it first gets one from the refresh cookie. When the session ends (signed
 * out elsewhere, expired, revoked) it sends the visitor to the login page and back afterwards.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const t = useTranslations('App');
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<'loading' | 'ready' | 'offline'>(
    session ? 'ready' : 'loading',
  );
  const hadSession = useRef(Boolean(session));

  useEffect(() => {
    if (state !== 'loading') return;
    let active = true;
    refreshSession()
      .then((restored) => {
        if (!active) return;
        if (restored) setState('ready');
        else router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      })
      .catch(() => active && setState('offline'));
    return () => {
      active = false;
    };
  }, [state, router, pathname]);

  useEffect(() => {
    if (session) {
      hadSession.current = true;
    } else if (hadSession.current && state === 'ready') {
      // The session ended while the app was open: a sign-out goes to a plain login page, an
      // expired or revoked session explains itself and returns here afterwards
      const end = getSessionEnd();
      router.replace(
        end === 'signedOut'
          ? '/login'
          : end === 'passwordChanged' || end === 'signedOutEverywhere'
            ? `/login?notice=${end}`
            : `/login?notice=expired&next=${encodeURIComponent(pathname)}`,
      );
    }
  }, [session, state, router, pathname]);

  if (state === 'offline') {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
        <Alert tone="danger">{t('offline')}</Alert>
        <Button onClick={() => setState('loading')}>{t('retry')}</Button>
      </div>
    );
  }

  if (!session) {
    return (
      <div
        role="status"
        className="flex min-h-dvh items-center justify-center gap-3 text-muted-foreground"
      >
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {t('loading')}
      </div>
    );
  }

  return children;
}
