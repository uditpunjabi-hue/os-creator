'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useCookie from 'react-use-cookie';
import { Instagram, Mail, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { cn } from '@gitroom/frontend/lib/utils';

const SEED_EMAIL = 'opnclaw123@gmail.com';
const SEED_PASSWORD = 'illuminati123';
const IG_COOKIE = 'illum-ig';
const GOOGLE_COOKIE = 'illum-google';

type ProviderKey = 'instagram' | 'google';

export function IlluminatiAuth() {
  const router = useRouter();
  const params = useSearchParams();
  const fetch = useFetch();
  const [igConnected, setIg] = useCookie(IG_COOKIE, '');
  const [googleConnected, setGoogle] = useCookie(GOOGLE_COOKIE, '');
  const [pending, setPending] = useState<ProviderKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Backend login as the seeded user — used for both providers in the placeholder flow.
  const placeholderLogin = useCallback(async () => {
    const res = await fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: SEED_EMAIL,
        password: SEED_PASSWORD,
        providerToken: '',
        provider: 'LOCAL',
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(txt || `Login failed: ${res.status}`);
    }
    return res.json();
  }, [fetch]);

  const handleConnect = useCallback(
    async (provider: ProviderKey) => {
      setError(null);
      setPending(provider);
      try {
        // Placeholder OAuth: sign in as the seeded creator and mark provider connected.
        await placeholderLogin();
        if (provider === 'instagram') setIg('@ariavance');
        else setGoogle(SEED_EMAIL);
        router.push(`/onboarding/connecting?provider=${provider}`);
      } catch (e) {
        setError((e as Error).message);
        setPending(null);
      }
    },
    [placeholderLogin, router, setIg, setGoogle]
  );

  const bothConnected = !!igConnected && !!googleConnected;

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
            pending={pending === 'instagram'}
            onClick={() => handleConnect('instagram')}
          />
          <ConnectCard
            provider="google"
            label="Google"
            sub="Connects Gmail, Calendar, and Drive in one consent."
            icon={Mail}
            connected={googleConnected}
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
  pending,
  onClick,
}: {
  provider: ProviderKey;
  label: string;
  sub: string;
  icon: typeof Instagram;
  connected: string;
  pending: boolean;
  onClick: () => void;
}) {
  const accent = provider === 'instagram' ? '#E1306C' : '#F59E0B'; // IG pink, Google gold
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || !!connected}
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
          {connected ? connected : sub}
        </div>
      </div>
      {!connected && !pending && (
        <ArrowRight className="h-4 w-4 shrink-0 text-[#6B6B6B] transition-transform group-hover:translate-x-0.5" />
      )}
    </button>
  );
}
