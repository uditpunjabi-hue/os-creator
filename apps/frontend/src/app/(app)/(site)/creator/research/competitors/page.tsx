'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  Trash2,
  Instagram,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { cn } from '@gitroom/frontend/lib/utils';

interface Competitor {
  id: string;
  organizationId: string;
  handle: string;
  platform: string;
  followers: number | null;
  engagement: number | null;
  growth30d: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MeProfile {
  connected: boolean;
  handle: string | null;
  followers: number | null;
  engagementRate: number | null;
}

const fmtFollowers = (n: number | null | undefined) => {
  if (n == null) return '—';
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${Math.round(n / 1_000)}k`
    : `${n}`;
};

export default function CompetitorsPage() {
  const fetch = useFetch();
  const [list, setList] = useState<Competitor[]>([]);
  const [me, setMe] = useState<MeProfile | null>(null);
  const [q, setQ] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [cRes, pRes] = await Promise.all([
      fetch('/creator/competitors'),
      fetch('/creator/profile'),
    ]);
    if (cRes.ok) setList((await cRes.json()) as Competitor[]);
    if (pRes.ok) setMe((await pRes.json()) as MeProfile);
  }, [fetch]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = list.filter((c) =>
    q.trim() ? c.handle.toLowerCase().includes(q.trim().toLowerCase()) : true
  );

  const add = async () => {
    const handle = newHandle.trim();
    if (!handle) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/creator/competitors', {
        method: 'POST',
        body: JSON.stringify({ handle }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setError(text || `Add failed: ${res.status}`);
        return;
      }
      setNewHandle('');
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/creator/competitors/${id}`, { method: 'DELETE' });
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const resync = async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/creator/competitors/${id}/resync`, { method: 'POST' });
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-2 px-4 py-3 lg:px-8 lg:py-5">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-gray-900">Inspiration</div>
            <div className="truncate text-xs text-gray-500">
              {list.length} creators tracked · synced via Instagram Business Discovery
            </div>
          </div>
          {list.length > 0 && (
            <a
              href="/creator/content/scripts"
              className="hidden shrink-0 items-center gap-1.5 rounded-full bg-[#F59E0B] px-3 py-1.5 text-xs font-semibold text-black hover:brightness-110 sm:inline-flex"
              title="Use these inspiration signals when generating your next script"
            >
              Use for scripting →
            </a>
          )}
        </div>

        <div className="flex flex-col gap-2 px-4 pb-3 lg:px-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                inputMode="text"
                placeholder="Add handle (e.g. @creator)"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
            </div>
            <Button type="submit" className="h-11 shrink-0" disabled={!newHandle.trim() || adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Track'}
            </Button>
          </form>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tracked creators"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
        {/* You row — live from /creator/profile */}
        {me && (
          <div className="mb-3 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-600">
              You
            </div>
            <div className="mt-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-gray-900">
                  {me.handle ?? '(not connected)'}
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                  <Stat label="Followers" value={fmtFollowers(me.followers)} />
                  <Stat
                    label="Engagement"
                    value={me.engagementRate != null ? `${me.engagementRate}%` : '—'}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {filtered.map((c) => {
            const growth = c.growth30d ?? 0;
            const isPositive = growth >= 0;
            return (
              <li
                key={c.id}
                className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <Instagram className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-gray-900">{c.handle}</div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => resync(c.id)}
                        disabled={busyId === c.id}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-300 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
                        aria-label="Re-sync"
                        title="Re-sync from Instagram"
                      >
                        {busyId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => remove(c.id)}
                        disabled={busyId === c.id}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-300 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                        aria-label="Stop tracking"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-gray-600">
                    <Stat label="Followers" value={fmtFollowers(c.followers)} />
                    <Stat
                      label="Engagement"
                      value={c.engagement != null ? `${c.engagement}%` : '—'}
                    />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">
                        30d growth
                      </span>
                      {c.growth30d != null ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-sm font-semibold',
                            isPositive ? 'text-emerald-600' : 'text-rose-600'
                          )}
                        >
                          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {isPositive ? '+' : ''}
                          {growth}%
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                  {c.notes && (
                    <div className="mt-2 line-clamp-2 text-[11px] text-gray-500">{c.notes}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
            <div className="text-sm font-medium text-gray-900">
              {list.length === 0 ? 'No creators tracked for inspiration yet' : 'No matches'}
            </div>
            <div className="max-w-xs text-xs text-gray-500">
              {list.length === 0
                ? 'Paste an Instagram handle above to start tracking. We pull follower count + recent engagement via the IG Business Discovery API.'
                : 'Try a different search.'}
            </div>
            {list.length === 0 && (
              <div className="text-[11px] text-gray-400">
                Note: Business Discovery only works for Business / Creator accounts. Personal IG profiles return blank stats.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}
