'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isApiError } from '@trueco/api-client';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { useState, type ReactNode } from 'react';

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
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>{children}</NuqsAdapter>
    </QueryClientProvider>
  );
}
