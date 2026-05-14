'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Last-resort error UI. Replaces Next.js's opaque "Application error: a
 * client-side exception has occurred" overlay with the real message + stack
 * so production crashes are debuggable.
 *
 * Pre-fork this rendered <NextError statusCode={0} /> (the opaque overlay)
 * and mounted Sentry.showReportDialog unconditionally — which crashed
 * silently when no DSN was configured. Sentry is now best-effort.
 *
 * Note: global-error replaces the entire root layout when it fires, so we
 * can't read useVariables() here — providers aren't mounted. Sentry will
 * still capture if its SDK was bootstrapped at module load.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error);
    try {
      Sentry.captureException(error);
    } catch {
      /* swallow — Sentry init issues shouldn't mask the original error */
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: '#0a0a0a',
          color: '#fafafa',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 720, width: '100%' }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 1.2,
                color: '#f87171',
                marginBottom: 8,
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Client-side error
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 600,
                margin: '0 0 12px',
                lineHeight: 1.3,
              }}
            >
              {error.message || 'Unknown error'}
            </h1>
            {error.digest && (
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>
                digest: <code>{error.digest}</code>
              </p>
            )}
            {error.stack && (
              <pre
                style={{
                  fontSize: 11,
                  lineHeight: 1.5,
                  background: '#171717',
                  border: '1px solid #262626',
                  borderRadius: 8,
                  padding: 12,
                  margin: '0 0 16px',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '50vh',
                }}
              >
                {error.stack}
              </pre>
            )}
            <button
              type="button"
              onClick={reset}
              style={{
                background: '#a855f7',
                color: 'white',
                border: 0,
                padding: '10px 16px',
                borderRadius: 8,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
