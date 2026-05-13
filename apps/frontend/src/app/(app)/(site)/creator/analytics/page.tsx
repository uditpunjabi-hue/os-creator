'use client';

import { useState } from 'react';
import {
  Eye,
  Heart,
  MessageSquare,
  Bookmark,
  Share2,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import { cn } from '@gitroom/frontend/lib/utils';

type Range = '7D' | '30D' | '90D';

interface PostRow {
  id: string;
  caption: string;
  publishedAgo: string;
  format: 'Reel' | 'Carousel' | 'Story';
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  predicted: number; // predicted reach
}

const posts: PostRow[] = [
  { id: 'p1', caption: '5 lighting mistakes that ruin reels', publishedAgo: '3 days ago', format: 'Reel', reach: 184_400, likes: 13_200, comments: 482, saves: 1_840, shares: 612, predicted: 140_000 },
  { id: 'p2', caption: 'My morning routine (no BS edition)', publishedAgo: '7 days ago', format: 'Reel', reach: 156_700, likes: 10_180, comments: 384, saves: 1_220, shares: 487, predicted: 145_000 },
  { id: 'p3', caption: 'Day in the life: solo creator + AI manager', publishedAgo: '12 days ago', format: 'Story', reach: 89_400, likes: 4_300, comments: 96, saves: 220, shares: 142, predicted: 95_000 },
  { id: 'p4', caption: 'Three product unboxings in 60s', publishedAgo: '18 days ago', format: 'Reel', reach: 141_000, likes: 9_640, comments: 312, saves: 1_080, shares: 401, predicted: 130_000 },
];

const summary = (range: Range) => {
  const m = range === '7D' ? 1 : range === '30D' ? 1.7 : 4.2;
  return [
    { label: 'Views', value: Math.round(341_100 * m), delta: 12.4, icon: Eye },
    { label: 'Likes', value: Math.round(23_380 * m), delta: 8.1, icon: Heart },
    { label: 'Comments', value: Math.round(866 * m), delta: -3.2, icon: MessageSquare },
    { label: 'Saves', value: Math.round(3_060 * m), delta: 22.7, icon: Bookmark },
    { label: 'Shares', value: Math.round(1_099 * m), delta: 6.8, icon: Share2 },
  ];
};

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k` : `${n}`;

export default function CreatorAnalyticsPage() {
  const [range, setRange] = useState<Range>('30D');
  const stats = summary(range);

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-2 px-4 py-3 lg:px-8 lg:py-5">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-gray-900">Analytics</div>
            <div className="truncate text-xs text-gray-500">
              Post performance · weekly report · growth tracking
            </div>
          </div>
          <div className="inline-flex rounded-full border border-gray-200 bg-white p-1">
            {(['7D', '30D', '90D'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'h-7 rounded-full px-3 text-xs font-semibold',
                  range === r ? 'bg-purple-600 text-white' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5 lg:gap-3">
          {stats.map((s) => {
            const Icon = s.icon;
            const positive = s.delta >= 0;
            return (
              <div
                key={s.label}
                className="flex flex-col gap-1.5 rounded-2xl border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-[10px] uppercase tracking-wide">{s.label}</span>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="text-xl font-semibold text-gray-900 lg:text-2xl">{fmt(s.value)}</div>
                <div
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px]',
                    positive ? 'text-emerald-600' : 'text-rose-600'
                  )}
                >
                  {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {positive ? '+' : ''}
                  {s.delta}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Weekly report card */}
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">Weekly report</div>
            <div className="mt-0.5 text-xs text-gray-600">
              Reels beat predicted reach by an average of <span className="font-semibold text-emerald-700">+18%</span> this week.
              Saves climbed 22% — your hooks are landing. Keep doubling down on lighting-themed posts.
            </div>
          </div>
        </div>

        {/* Posts list */}
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Recent posts
          </div>
          <ul className="flex flex-col gap-2">
            {posts.map((p) => {
              const diff = p.reach - p.predicted;
              const diffPct = Math.round((diff / p.predicted) * 100);
              const beat = diff >= 0;
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">
                        {p.caption}
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-500">
                        {p.format} · {p.publishedAgo}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        beat ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      )}
                    >
                      {beat ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {beat ? '+' : ''}
                      {diffPct}% vs predicted
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    <Metric icon={Eye} label="Reach" value={fmt(p.reach)} />
                    <Metric icon={Heart} label="Likes" value={fmt(p.likes)} />
                    <Metric icon={MessageSquare} label="Comments" value={fmt(p.comments)} />
                    <Metric icon={Bookmark} label="Saves" value={fmt(p.saves)} />
                    <Metric icon={Share2} label="Shares" value={fmt(p.shares)} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-1.5 py-2">
      <Icon className="mx-auto h-3 w-3 text-gray-400" />
      <div className="mt-0.5 text-[13px] font-semibold text-gray-900">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  );
}
