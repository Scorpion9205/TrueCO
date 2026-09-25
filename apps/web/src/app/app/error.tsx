'use client';

import { ErrorView } from '@/components/errors/error-view';

// Inside the app shell, so the menu stays usable when one page fails
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorView error={error} reset={reset} homeHref="/app" />;
}
