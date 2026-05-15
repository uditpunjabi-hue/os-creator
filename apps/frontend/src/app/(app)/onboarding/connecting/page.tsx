'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Instagram, Mail, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

type Provider = 'instagram' | 'google';

const copyByProvider: Record<
  Provider,
  { title: string; steps: string[]; icon: typeof Instagram; accent: string }
> = {
  instagram: {
    title: 'Setting up your studio',
    steps: [
      'Authenticating with Instagram',
      'Pulling profile, followers, and bio',
      'Indexing your last 50 posts',
      'Running your AI manager',
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

const PER_STEP_MS = 700;

interface SelfPayload {
  name?: string | null;
  instagramHandle?: string | null;
  googleEmail?: string | null;
}

export default function OnboardingConnectingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const fetch = useFetch();
  const provider = (params.get('provider') as Provider) || 'instagram';
  const isNewUser = params.get('new') === '1';
  const warning = params.get('warning');
  const [step, setStep] = useState(0);
  const [self, setSelf] = useState<SelfPayload | null>(null);

  const config = copyByProvider[provider] ?? copyByProvider.instagram;
  const Icon = config.icon;
  const totalSteps = config.steps.length;

  // Pull the freshly-signed-in user so we can greet them by handle. /user/self
  // requires the auth cookie that the OAuth callback just set, so this
  // doubles as a "did the JWT actually land?" probe.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/user/self');
        if (!cancelled && res.ok) {
          setSelf((await res.json()) as SelfPayload);
        }
      } catch {
        // Ignore — the onboarding still works without a name.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetch]);

  // For Instagram new-user signups, kick off the master intelligence build
  // in the background. The endpoint is cached + de-duped, so calling it here
  // means by the time the user lands on the dashboard the data is warm.
  useEffect(() => {
    if (provider !== 'instagram' || !isNewUser) return;
    let cancelled = false;
    void (async () => {
      try {
        await fetch('/creator/intelligence');
      } catch {
        // Ignore — non-fatal; the dashboard re-fetches on its own.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, isNewUser, fetch]);

  useEffect(() => {
    if (step >= totalSteps) {
      // Always land on the creator dashboard after a successful sign-in.
      // The user can navigate to the manager surface from the bottom-nav.
      const target = '/creator/research/profile';
      const t = setTimeout(() => router.replace(target), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), PER_STEP_MS);
    return () => clearTimeout(t);
  }, [step, totalSteps, router]);

  const greeting = (() => {
    if (provider === 'instagram') {
      const handle = self?.instagramHandle ?? null;
      if (handle) return isNewUser ? `Welcome ${handle}!` : `Welcome back ${handle}`;
      return isNewUser ? 'Welcome to Illuminati!' : 'Welcome back';
    }
    const email = self?.googleEmail;
    return email ? `Welcome ${email.split('@')[0]}` : 'Welcome back';
  })();

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
          style={{ backgroundColor: `${config.accent}22`, color: config.accent }}
        >
          <Icon className="h-7 w-7" />
        </div>

        <h1 className="mb-1 text-center text-xl font-semibold text-white">
          {greeting}
        </h1>
        <p className="mb-8 text-center text-sm text-[#9C9C9C]">{config.title}…</p>

        {warning === 'no_ig_business' && (
          <div className="mb-3 flex w-full items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">No Business account found.</div>
              <div className="mt-1 opacity-90">
                Profile insights require an IG Business or Creator account linked to a Facebook Page.
              </div>
            </div>
          </div>
        )}

        <ul className="flex w-full flex-col gap-2 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-3">
          {config.steps.map((label, idx) => {
            const done = idx < step;
            const active = idx === step;
            return (
              <li key={label} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
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
                  className={done || active ? 'text-sm text-white' : 'text-sm text-[#6B6B6B]'}
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
