'use client';

import { Loader2, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signOut } from '@/lib/auth/session';
import { useSession } from '@/lib/auth/use-session';

export function AppHome() {
  const t = useTranslations('App');
  const session = useSession();
  const [signingOut, setSigningOut] = useState(false);

  // SessionGate moves to the login page once the session is cleared
  const handleSignOut = () => {
    setSigningOut(true);
    void signOut();
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 sm:px-6">
      <header className="flex h-16 items-center justify-between">
        <Logo href="/app" />
        <Button variant="outline" size="sm" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
          {signingOut ? t('signingOut') : t('signOut')}
        </Button>
      </header>
      <main className="flex flex-1 items-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl">
              {t('welcome', { name: session?.user.name ?? '' })}
            </CardTitle>
            <CardDescription>{t('placeholder')}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{session?.user.email}</CardContent>
        </Card>
      </main>
    </div>
  );
}
