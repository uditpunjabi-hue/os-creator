'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Instagram, Loader2, ArrowRight } from 'lucide-react';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { useVariables } from '@gitroom/react/helpers/variable.context';

// ---------------------------------------------------------------------------
// Login surface — dark, OAuth-only. Two big buttons (IG purple gradient,
// Google neutral); no email/password. Errors from the OAuth callbacks come
// back as ?error= and are surfaced inline so the user knows why the flow
// bounced them back.
// ---------------------------------------------------------------------------

type ProviderKey = 'instagram' | 'google';

const knownErrors: Record<string, string> = {
  google_token_exchange:
    "Google sign-in is being set up — we're still in testing-mode approval. Continue with Instagram for now; you can connect Google later from Settings.",
  google_no_email:
    'Google did not return an email address. Try again with a different account.',
  meta_token_exchange:
    'Meta rejected the token exchange. Check META_APP_ID + META_APP_SECRET and the redirect URI in developers.facebook.com.',
  google_callback:
    "Google sign-in is being set up — we're still in testing-mode approval. Continue with Instagram for now; you can connect Google later from Settings.",
  instagram_callback:
    'Instagram callback failed unexpectedly. Check the backend logs.',
  no_code:
    'OAuth provider returned no auth code (you may have denied consent).',
  no_ig_business:
    'Instagram OAuth completed but no Business / Creator account was found. Link your IG account to a Facebook Page first.',
  access_denied:
    "Access was denied on the consent screen. If you tried Google, it's currently in testing mode — use Instagram to sign in for now.",
};

export function IlluminatiAuth() {
  const params = useSearchParams();
  const { backendUrl } = useVariables();
  const [pending, setPending] = useState<ProviderKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const err = params.get('error');
    const detail = params.get('detail');
    if (err) {
      const base = knownErrors[err] ?? `OAuth error: ${err}`;
      setError(detail ? `${base}\n\nDetail: ${detail}` : base);
    }
  }, [params]);

  const handleConnect = useCallback(
    (provider: ProviderKey) => {
      setError(null);
      setPending(provider);
      window.location.href = `${backendUrl}/oauth/${provider}/start`;
    },
    [backendUrl]
  );

  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center px-4 py-12"
      style={{
        background:
          'linear-gradient(180deg, var(--illum-bg-start, #0F0F0F) 0%, var(--illum-bg-end, #1F1F1F) 100%)',
      }}
    >
      <div className="flex w-full max-w-[420px] flex-col items-center">
        <div className="relative mb-6">
          <div
            className="absolute inset-0 -z-10 rounded-full blur-2xl"
            style={{
              background:
                'radial-gradient(circle, var(--illum-accent-glow, rgba(245,158,11,0.30)), transparent 60%)',
            }}
            aria-hidden="true"
          />
          <Logo size={88} />
        </div>

        <h1 className="text-center text-[28px] font-semibold leading-tight text-white">
          Illuminati
        </h1>
        <p className="mt-1.5 text-center text-sm text-[#A1A1AA]">
          Your AI-powered creator studio
        </p>

        {error && (
          <div className="mt-6 w-full whitespace-pre-line rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-8 flex w-full flex-col gap-3">
          {/* Primary CTA — Instagram is all you need to use the app. The
              recommended-pill anchors it visually so it doesn't look like
              two equal options. */}
          <div className="relative">
            <span className="absolute -top-2.5 left-4 z-10 rounded-full bg-[#F59E0B] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
              Recommended
            </span>
            <button
              type="button"
              onClick={() => handleConnect('instagram')}
              disabled={pending !== null}
              className="group relative inline-flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#EC4899] px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(124,58,237,0.35)] transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-80"
            >
              {pending === 'instagram' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Instagram className="h-5 w-5" />
              )}
              <span>Continue with Instagram</span>
              {pending !== 'instagram' && (
                <ArrowRight className="h-4 w-4 opacity-80 transition-transform group-hover:translate-x-0.5" />
              )}
            </button>
          </div>

          <div className="my-1 flex items-center gap-3 text-[10px] uppercase tracking-wider text-[#4B5563]">
            <span className="h-px flex-1 bg-[#2A2A2A]" />
            <span>Optional</span>
            <span className="h-px flex-1 bg-[#2A2A2A]" />
          </div>

          <button
            type="button"
            onClick={() => handleConnect('google')}
            disabled={pending !== null}
            className="group relative inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 text-sm font-medium text-white transition-colors hover:border-[#3A3A3A] hover:bg-[#1F1F1F] disabled:opacity-80"
          >
            {pending === 'google' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="h-4 w-4" />
            )}
            <span>Continue with Google</span>
            <span className="text-[11px] text-[#6B7280]">(Gmail + Calendar)</span>
          </button>
        </div>

        <p className="mt-6 max-w-[360px] text-center text-[11px] leading-relaxed text-[#6B7280]">
          Instagram is all you need to start. Google connects optional
          inbox / calendar features and can be added later from Settings.
          You can disconnect at any time.
        </p>
      </div>
    </div>
  );
}

// Multi-color Google "G" — matches Google's brand kit closely enough for the
// purpose without pulling in their SDK.
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
