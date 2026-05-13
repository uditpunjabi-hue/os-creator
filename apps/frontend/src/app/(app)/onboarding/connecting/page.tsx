'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useCookie from 'react-use-cookie';
import { Instagram, Mail, CheckCircle2, Loader2 } from 'lucide-react';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';

type Provider = 'instagram' | 'google';

const copyByProvider: Record<Provider, { title: string; steps: string[]; icon: typeof Instagram; accent: string }> = {
  instagram: {
    title: 'Fetching your profile',
    steps: [
      'Authenticating with Instagram',
      'Pulling profile, followers, and bio',
      'Indexing your last 50 posts',
      'Calculating engagement and reach',
    ],
    icon: Instagram,
    accent: '#E1306C',
  },
  google: {
    title: 'Connecting your workspace',
    steps: [
      'Authenticating with Google',
      'Granting Gmail, Calendar, and Drive scopes',
      'Pulling latest brand emails',
      'Syncing calendar events',
    ],
    icon: Mail,
    accent: '#F59E0B',
  },
};

const PER_STEP_MS = 600;

export default function OnboardingConnectingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const provider = (params.get('provider') as Provider) || 'instagram';
  const [step, setStep] = useState(0);
  const [igConnected] = useCookie('illum-ig', '');
  const [googleConnected] = useCookie('illum-google', '');

  const config = copyByProvider[provider] ?? copyByProvider.instagram;
  const Icon = config.icon;
  const totalSteps = config.steps.length;

  useEffect(() => {
    if (step >= totalSteps) {
      // Decide next destination based on what's connected.
      const next =
        provider === 'instagram' && !googleConnected
          ? '/auth/login?stay=1'
          : !igConnected
          ? '/auth/login?stay=1'
          : '/creator/research/profile';
      const t = setTimeout(() => router.replace(next), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), PER_STEP_MS);
    return () => clearTimeout(t);
  }, [step, totalSteps, provider, router, igConnected, googleConnected]);

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

        <div
          className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: `${config.accent}22`,
            color: config.accent,
          }}
        >
          <Icon className="h-7 w-7" />
        </div>

        <h1 className="mb-1 text-center text-xl font-semibold text-white">
          {config.title}
        </h1>
        <p className="mb-8 text-center text-sm text-[#9C9C9C]">
          This will only take a moment.
        </p>

        <ul className="flex w-full flex-col gap-2 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-3">
          {config.steps.map((label, idx) => {
            const done = idx < step;
            const active = idx === step;
            return (
              <li
                key={label}
                className="flex items-center gap-3 rounded-xl px-2 py-1.5"
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: done
                      ? 'rgba(16,185,129,0.16)'
                      : active
                      ? `${config.accent}22`
                      : 'transparent',
                    color: done ? '#34D399' : active ? config.accent : '#4F4F4F',
                  }}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4F4F4F]" />
                  )}
                </div>
                <span
                  className={
                    done || active
                      ? 'text-sm text-white'
                      : 'text-sm text-[#6B6B6B]'
                  }
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
