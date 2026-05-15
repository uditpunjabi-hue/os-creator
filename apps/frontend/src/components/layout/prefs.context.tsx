'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

// ---------------------------------------------------------------------------
// Personalization prefs. These live in localStorage rather than the database
// because they're cosmetic-only (theme, font size, AI nickname) — no need
// to round-trip the server, and they apply instantly on switch.
//
// On mount we hydrate from localStorage and stamp the values onto
// document.documentElement as `data-theme` + `data-font-size` so the rest
// of the app (global.scss) can read them via CSS attribute selectors.
// ---------------------------------------------------------------------------

export type ThemeKey = 'light' | 'dark';
export type FontSizeKey = 'sm' | 'md' | 'lg';

export interface Prefs {
  theme: ThemeKey;
  fontSize: FontSizeKey;
  aiAgentName: string;
}

const DEFAULT: Prefs = {
  theme: 'light',
  fontSize: 'md',
  aiAgentName: 'Illuminati AI',
};

const STORAGE_KEY = 'illuminati.prefs';

interface PrefsContextValue extends Prefs {
  setTheme: (t: ThemeKey) => void;
  setFontSize: (f: FontSizeKey) => void;
  setAiAgentName: (name: string) => void;
}

const PrefsContext = createContext<PrefsContextValue | null>(null);

export function usePrefs(): PrefsContextValue {
  const v = useContext(PrefsContext);
  // Falling back to defaults instead of throwing keeps the API safe to call
  // from server-rendered components that wrap children before the provider
  // mounts. Mutators are no-ops in that branch.
  if (!v) return { ...DEFAULT, setTheme: noop, setFontSize: noop, setAiAgentName: noop };
  return v;
}

function noop() {
  /* no-op */
}

function applyToRoot(prefs: Prefs) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', prefs.theme);
  root.setAttribute('data-font-size', prefs.fontSize);
  // Dark surface overrides live under `body.dark` in global.scss — toggling
  // the class is what actually flips every bg-white/text-gray-* across the
  // app. data-theme alone only feeds the auth/onboarding gradient.
  const body = document.body;
  if (body) {
    if (prefs.theme === 'dark') body.classList.add('dark');
    else body.classList.remove('dark');
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);

  // Hydrate from localStorage on first paint. Any old / malformed entries
  // are ignored — we fall back to defaults rather than crash.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Prefs>;
        // Old installs may have 'midnight' / 'purple' stored from the
        // previous 3-theme picker — normalize to dark.
        const rawTheme = parsed.theme as string | undefined;
        const theme: ThemeKey =
          rawTheme === 'dark' || rawTheme === 'midnight' || rawTheme === 'purple'
            ? 'dark'
            : rawTheme === 'light'
              ? 'light'
              : DEFAULT.theme;
        const next: Prefs = {
          theme,
          fontSize: (parsed.fontSize as FontSizeKey) ?? DEFAULT.fontSize,
          aiAgentName: (parsed.aiAgentName ?? DEFAULT.aiAgentName).trim() || DEFAULT.aiAgentName,
        };
        setPrefs(next);
        applyToRoot(next);
        return;
      }
    } catch {
      // Ignore JSON parse errors.
    }
    applyToRoot(DEFAULT);
  }, []);

  const persist = useCallback((next: Prefs) => {
    setPrefs(next);
    applyToRoot(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Quota exceeded / disabled storage — runtime continues with the
      // in-memory value, just won't survive reload.
    }
  }, []);

  const value = useMemo<PrefsContextValue>(
    () => ({
      ...prefs,
      setTheme: (theme: ThemeKey) => persist({ ...prefs, theme }),
      setFontSize: (fontSize: FontSizeKey) => persist({ ...prefs, fontSize }),
      setAiAgentName: (aiAgentName: string) =>
        persist({ ...prefs, aiAgentName: aiAgentName.trim() || DEFAULT.aiAgentName }),
    }),
    [prefs, persist]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}
