'use client';

import { useEffect } from 'react';

/**
 * Last resort, when the root layout itself fails: it replaces the whole document, so there are
 * no translations, fonts or styles to rely on. Plain English and inline styles only.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'grid',
          placeItems: 'center',
          minHeight: '100dvh',
          margin: 0,
          padding: 16,
          textAlign: 'center',
        }}
      >
        <main>
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p style={{ color: '#57534e' }}>TrueCO couldn&apos;t load. Please try again.</p>
          {error.digest ? (
            <p style={{ color: '#57534e', fontSize: 12 }}>Reference: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              borderRadius: 999,
              border: 0,
              background: '#c2410c',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
