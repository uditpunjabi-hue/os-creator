'use client';

import { useEffect, useState } from 'react';
import { Mail, X, ArrowRight } from 'lucide-react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';

const DISMISS_KEY = 'illuminati.dismiss.connect-google';

interface ProfileResponse {
  connections?: { google?: { connected?: boolean } };
}

/**
 * Dismissible prompt that appears across the app when Google is not
 * connected. Instagram alone unlocks every creator feature; Google brings
 * the inbox / calendar features online. The banner is opt-in: once dismissed,
 * a localStorage flag silences it until the user manually clears it
 * (Settings → Connect Google is the always-on path).
 */
export function ConnectGoogleBanner() {
  const fetch = useFetch();
  const { backendUrl } = useVariables();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1') {
          return;
        }
        const res = await fetch('/manager/settings/profile');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ProfileResponse;
        if (!data.connections?.google?.connected) setShow(true);
      } catch {
        // Silent — the banner is purely informational; if profile fetch
        // fails we just don't show it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetch]);

  if (!show) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50/70 px-4 py-2 lg:px-8">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Mail className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 text-[12px] leading-snug text-amber-900">
          <span className="font-semibold">Connect Google</span>
          <span className="text-amber-800/90"> to unlock email replies and calendar sync — optional, takes ~10 seconds.</span>
        </div>
        <a
          href={`${backendUrl}/oauth/google/start`}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-white px-3 text-[11px] font-semibold text-amber-800 hover:border-amber-400 hover:bg-amber-50"
        >
          Connect <ArrowRight className="h-3 w-3" />
        </a>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, '1');
            } catch {
              // localStorage not available — banner just won't persist dismissal.
            }
            setShow(false);
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-amber-700 hover:bg-amber-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
