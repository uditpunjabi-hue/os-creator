'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Instagram, Mail, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { cn } from '@gitroom/frontend/lib/utils';

type ProviderKey = 'instagram' | 'google';

interface ConnectionStatus {
  google: { connected: boolean; email?: string | null };
  instagram: { connected: boolean; handle?: string | null };
}

const knownErrors: Record<string, string> = {
  google_token_exchange: 'Google rejected the token exchange. Re-check the OAuth client ID + secret and redirect URI in console.cloud.google.com.',
  meta_token_exchange: 'Meta rejected the token exchange. Re-check META_APP_ID + META_APP_SECRET and the redirect URI in developers.facebook.com.',
  google_callback: 'Google callback failed unexpectedly. Check the backend logs.',
  instagram_callback: 'Instagram callback failed unexpectedly. Check the backend logs.',
  no_code: 'OAuth provider returned no auth code (you may have denied consent).',
};

export function IlluminatiAuth() {
  const router = useRouter();
  const params = useSearchParams();
  const fetch = useFetch();
  const { backendUrl } = useVariables();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [pending, setPending] = useState<ProviderKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pull live connection status from the backend (authenticated endpoint).
  // A 401 just means "not signed in yet" — render the unconnected state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/connections');
        if (!res.ok) {
          if (!cancelled) setStatus({ google: { connected: false }, instagram: { connected: false } });
          return;
        }
        const data = (await res.json()) as ConnectionStatus;
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) setStatus({ google: { connected: false }, instagram: { connected: false } });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetch]);

  useEffect(() => {
    const err = params.get('error');
    if (err) setError(knownErrors[err] ?? `OAuth error: ${err}`);
  }, [params]);

  const handleConnect = useCallback(
    (provider: ProviderKey) => {
      setError(null);
      setPending(provider);
      // Full page nav to the backend OAuth start route — it 302s to Google/Meta.
      window.location.href = `${backendUrl}/oauth/${provider}/start`;
    },
    [backendUrl]
  );

  const igConnected = status?.instagram.connected ?? false;
  const googleConnected = status?.google.connected ?? false;
  const igLabel = status?.instagram.handle ?? null;
  const googleLabel = status?.google.email ?? null;
  const bothConnected = igConnected && googleConnected;

  // If user lands here already fully connected, auto-bounce to dashboard.
  useEffect(() => {
    if (bothConnected && params.get('stay') !== '1') {
      router.replace('/creator/research/profile');
    }
  }, [bothConnected, params, router]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#0F0F0F] px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={48} />
          <div className="text-left">
            <div className="text-xl font-semibold text-white">Illuminati</div>
            <div className="text-xs text-[#9C9C9C]">Creator OS</div>
          </div>
        </div>

        <h1 className="mb-1 text-center text-2xl font-semibold text-white">
          Welcome.
        </h1>
        <p className="mb-8 max-w-sm text-center text-sm text-[#9C9C9C]">
          Connect Instagram and Google to set up your studio. Your AI manager takes it from there.
        </p>

        {error && (
          <div className="mb-4 w-full rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="flex w-full flex-col gap-3">
          <ConnectCard
            provider="instagram"
            label="Instagram"
            sub="Pulls your profile, followers, and post performance."
            icon={Instagram}
            connected={igConnected}
            connectedLabel={igLabel}
            pending={pending === 'instagram'}
            onClick={() => handleConnect('instagram')}
          />
          <ConnectCard
            provider="google"
            label="Google"
            sub="Connects Gmail, Calendar, and Drive in one consent."
            icon={Mail}
            connected={googleConnected}
            connectedLabel={googleLabel}
            pending={pending === 'google'}
            onClick={() => handleConnect('google')}
          />
        </div>

        {bothConnected && (
          <button
            onClick={() => router.push('/creator/research/profile')}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#7C3AED] text-sm font-semibold text-white shadow-[0_8px_24px_rgba(124,58,237,0.35)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            Enter your studio <ArrowRight className="h-4 w-4" />
          </button>
        )}

        <div className="mt-8 max-w-xs text-center text-[11px] leading-relaxed text-[#6B6B6B]">
          By continuing you agree to grant Illuminati permission to read your
          profile and send emails on your behalf. You can disconnect from
          Settings at any time.
        </div>
      </div>
    </div>
  );
}

function ConnectCard({
  provider,
  label,
  sub,
  icon: Icon,
  connected,
  connectedLabel,
  pending,
  onClick,
}: {
  provider: ProviderKey;
  label: string;
  sub: string;
  icon: typeof Instagram;
  connected: boolean;
  connectedLabel: string | null;
  pending: boolean;
  onClick: () => void;
}) {
  const accent = provider === 'instagram' ? '#E1306C' : '#F59E0B'; // IG pink, Google gold
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || connected}
      className={cn(
        'group flex items-center gap-4 rounded-2xl border bg-[#1A1A1A] p-4 text-left transition-colors',
        connected
          ? 'border-emerald-500/40 cursor-default'
          : 'border-[#2A2A2A] hover:border-[#383838] active:bg-[#232323]',
        pending && 'opacity-90'
      )}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor: connected ? 'rgba(16,185,129,0.16)' : `${accent}22`,
          color: connected ? '#34D399' : accent,
        }}
      >
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : connected ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <Icon className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-white">
          {connected ? `${label} connected` : `Continue with ${label}`}
        </div>
        <div className="truncate text-xs text-[#9C9C9C]">
          {connected ? connectedLabel ?? 'Account linked' : sub}
        </div>
      </div>
      {!connected && !pending && (
        <ArrowRight className="h-4 w-4 shrink-0 text-[#6B6B6B] transition-transform group-hover:translate-x-0.5" />
      )}
    </button>
  );
}
