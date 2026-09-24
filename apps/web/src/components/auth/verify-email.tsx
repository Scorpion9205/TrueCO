'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { publicApi } from '@/lib/api';

type Status = 'checking' | 'success' | 'failed';

export function VerifyEmail({ token }: { token: string }) {
  const t = useTranslations('Auth.verify');
  const [status, setStatus] = useState<Status>('checking');
  // Tokens are single-use: React's dev double-effect must not send it twice (the second would fail)
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    publicApi
      .post('/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch(() => setStatus('failed'));
  }, [token]);

  if (status === 'checking') {
    return (
      <p role="status" className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {t('checking')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Alert tone={status === 'success' ? 'success' : 'danger'}>{t(status)}</Alert>
      <Button asChild size="lg">
        <Link href="/app">{t('continue')}</Link>
      </Button>
    </div>
  );
}
