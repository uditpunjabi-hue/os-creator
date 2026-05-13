'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, TrendingUp, TrendingDown, Trash2, Instagram, Music2, Youtube } from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { cn } from '@gitroom/frontend/lib/utils';

type Platform = 'instagram' | 'tiktok' | 'youtube';

interface Competitor {
  id: string;
  handle: string;
  platform: Platform;
  followers: number;
  engagement: number;
  growth30d: number;
}

const initial: Competitor[] = [
  { id: '1', handle: '@matty.bts', platform: 'instagram', followers: 412_000, engagement: 4.8, growth30d: 6.2 },
  { id: '2', handle: '@maya.films', platform: 'instagram', followers: 268_400, engagement: 6.1, growth30d: 3.4 },
  { id: '3', handle: '@adamtheeditor', platform: 'tiktok', followers: 1_240_000, engagement: 7.9, growth30d: 12.1 },
  { id: '4', handle: '@sora.studio', platform: 'instagram', followers: 89_700, engagement: 9.3, growth30d: 18.5 },
  { id: '5', handle: '@nicotravels', platform: 'instagram', followers: 351_200, engagement: 3.6, growth30d: -1.8 },
  { id: '6', handle: '@hellojulesco', platform: 'youtube', followers: 612_000, engagement: 5.2, growth30d: 2.7 },
  { id: '7', handle: '@frame.by.frame', platform: 'tiktok', followers: 184_300, engagement: 8.4, growth30d: 9.6 },
];

const me = { handle: '@ariavance', followers: 128_420, engagement: 5.8, growth30d: 4.4 };

const platformIcon: Record<Platform, typeof Instagram> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
};

const fmtFollowers = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : `${n}`;

export default function CompetitorsPage() {
  const [list, setList] = useState<Competitor[]>(initial);
  const [q, setQ] = useState('');
  const [newHandle, setNewHandle] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((c) => c.handle.toLowerCase().includes(term));
  }, [list, q]);

  const add = () => {
    const handle = newHandle.trim();
    if (!handle) return;
    setList((prev) => [
      {
        id: String(Date.now()),
        handle: handle.startsWith('@') ? handle : `@${handle}`,
        platform: 'instagram',
        followers: Math.floor(50_000 + Math.random() * 400_000),
        engagement: Number((3 + Math.random() * 6).toFixed(1)),
        growth30d: Number((Math.random() * 16 - 4).toFixed(1)),
      },
      ...prev,
    ]);
    setNewHandle('');
  };

  const remove = (id: string) => setList((prev) => prev.filter((c) => c.id !== id));

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-2 px-4 py-3 lg:px-8 lg:py-5">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-gray-900">Competitors</div>
            <div className="truncate text-xs text-gray-500">
              {list.length} tracked · benchmarked against you
            </div>
          </div>
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
            <Button type="submit" className="h-11 shrink-0" disabled={!newHandle.trim()}>
              Track
            </Button>
          </form>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tracked competitors"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
        {/* You row */}
        <div className="mb-3 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-600">
            You
          </div>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900">{me.handle}</div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-gray-600">
                <Stat label="Followers" value={fmtFollowers(me.followers)} />
                <Stat label="Engagement" value={`${me.engagement}%`} />
                <Stat label="30d growth" value={`${me.growth30d > 0 ? '+' : ''}${me.growth30d}%`} positive={me.growth30d >= 0} />
              </div>
            </div>
          </div>
        </div>

        <ul className="flex flex-col gap-2">
          {filtered.map((c) => {
            const Icon = platformIcon[c.platform];
            const isPositive = c.growth30d >= 0;
            return (
              <li
                key={c.id}
                className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-gray-900">{c.handle}</div>
                    <button
                      onClick={() => remove(c.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-300 hover:bg-rose-50 hover:text-rose-500"
                      aria-label="Stop tracking"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-gray-600">
                    <Stat label="Followers" value={fmtFollowers(c.followers)} />
                    <Stat label="Engagement" value={`${c.engagement}%`} />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">30d growth</span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-sm font-semibold',
                          isPositive ? 'text-emerald-600' : 'text-rose-600'
                        )}
                      >
                        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isPositive ? '+' : ''}{c.growth30d}%
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
            <div className="text-sm font-medium text-gray-900">No matches</div>
            <div className="max-w-xs text-xs text-gray-500">
              Try a different search or paste a handle above to start tracking.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold text-gray-900',
          positive === false && 'text-rose-600',
          positive === true && 'text-emerald-600'
        )}
      >
        {value}
      </span>
    </div>
  );
}
