'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isApiError } from '@trueco/api-client';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { useEffect, useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { getSession, subscribe } from '@/lib/auth/session';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Retrying a 4xx (not found, forbidden, invalid) cannot succeed; only retry server/network failures
        retry: (failureCount, error) =>
          failureCount < 2 && (!isApiError(error) || error.isRetryable),
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session (and per request on the server), never shared between users
  const [queryClient] = useState(makeQueryClient);

  // Drop every cached response when the session ends, so the next person on this device starts
  // clean (queries are also keyed by user id)
  useEffect(
    () =>
      subscribe(() => {
        if (!getSession()) queryClient.clear();
      }),
    [queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>{children}</NuqsAdapter>
      <Toaster />
    </QueryClientProvider>
  );
}
