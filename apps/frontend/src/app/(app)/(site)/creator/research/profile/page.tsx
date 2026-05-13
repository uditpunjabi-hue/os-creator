'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp,
  Heart,
  Users,
  Clock,
  Lightbulb,
  AlertCircle,
  Instagram,
  Loader2,
} from 'lucide-react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { cn } from '@gitroom/frontend/lib/utils';

interface IgMedia {
  id: string;
  caption: string | null;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  likeCount: number;
  commentsCount: number;
  timestamp: string;
}

interface IgProfile {
  connected: boolean;
  handle: string | null;
  followers: number | null;
  mediaCount: number | null;
  bio: string | null;
  profilePic: string | null;
  engagementRate: number | null;
  recentMedia: IgMedia[];
}

const mockStats = [
  { label: 'Followers', value: '128,420', delta: '+3.4% MoM', positive: true, icon: Users },
  { label: 'Engagement', value: '5.8%', delta: '+0.6% vs niche', positive: true, icon: Heart },
  { label: 'Reach (30d)', value: '2.1M', delta: '+12.1% MoM', positive: true, icon: TrendingUp },
  { label: 'Best time', value: '6:30 PM', delta: 'Tue · Thu', positive: true, icon: Clock },
];

const mockTopPosts = [
  { caption: '5 lighting mistakes that ruin reels', reach: 184_000, engagement: 7.2, format: 'Reel' },
  { caption: 'My morning routine (no BS edition)', reach: 156_000, engagement: 6.4, format: 'Reel' },
  { caption: 'Three product unboxings in 60s', reach: 141_000, engagement: 5.9, format: 'Reel' },
];

const trend = [120_100, 120_640, 121_080, 121_700, 122_400, 123_000, 123_900, 124_700, 125_400, 126_100, 126_800, 127_400, 127_900, 128_420];

const insights = [
  { kind: 'good', icon: TrendingUp, title: 'Reels outperform carousels 3.2x', detail: 'Lean into Reels — your top 5 posts this month are all Reels with hooks in the first 2 seconds.' },
  { kind: 'good', icon: Lightbulb, title: 'Tuesday 6:30 PM is your sweet spot', detail: 'Posts at this slot reach 38% more accounts than your average.' },
  { kind: 'warn', icon: AlertCircle, title: 'Carousel engagement dropped 18% MoM', detail: 'Try a single bold cover slide instead of a 10-slide deep-dive — the format is taxing readers.' },
] as const;

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k` : `${n}`;

export default function CreatorProfile() {
  const fetch = useFetch();
  const { backendUrl } = useVariables();
  const [profile, setProfile] = useState<IgProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/creator/profile');
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data = (await res.json()) as IgProfile;
        if (!cancelled) {
          setProfile(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetch]);

  const live = profile?.connected ?? false;

  // Live stats — fall back to mock for fields the IG Graph API doesn't expose.
  const stats = live
    ? [
        {
          label: 'Followers',
          value: profile!.followers != null ? fmt(profile!.followers) : '—',
          delta: 'Live from Instagram',
          positive: true,
          icon: Users,
        },
        {
          label: 'Engagement',
          value:
            profile!.engagementRate != null
              ? `${profile!.engagementRate}%`
              : '—',
          delta: 'Avg over recent posts',
          positive: true,
          icon: Heart,
        },
        {
          label: 'Posts',
          value: profile!.mediaCount != null ? fmt(profile!.mediaCount) : '—',
          delta: 'Total on profile',
          positive: true,
          icon: TrendingUp,
        },
        {
          label: 'Best time',
          value: '6:30 PM',
          delta: 'Tue · Thu (heuristic)',
          positive: true,
          icon: Clock,
        },
      ]
    : mockStats;

  // Top posts from live media (sorted by likes+comments) or mock fallback.
  const topPosts = live
    ? [...profile!.recentMedia]
        .sort(
          (a, b) =>
            b.likeCount + b.commentsCount - (a.likeCount + a.commentsCount)
        )
        .slice(0, 3)
        .map((m) => ({
          caption: (m.caption ?? '(no caption)').slice(0, 80),
          reach: m.likeCount + m.commentsCount,
          engagement:
            profile!.followers && profile!.followers > 0
              ? Math.round(
                  ((m.likeCount + m.commentsCount) / profile!.followers) *
                    100 *
                    100
                ) / 100
              : 0,
          format: m.mediaType === 'VIDEO' ? 'Reel' : m.mediaType === 'CAROUSEL_ALBUM' ? 'Carousel' : 'Photo',
        }))
    : mockTopPosts;

  const max = Math.max(...trend);
  const min = Math.min(...trend);

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 lg:px-8 lg:py-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-gray-900">My Profile</div>
            <div className="truncate text-xs text-gray-500">
              {live && profile?.handle
                ? `${profile.handle} · live from Instagram`
                : 'Audience pulse · last 30 days'}
            </div>
          </div>
          <span
            className={cn(
              'inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-medium',
              live
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-gray-200 bg-white text-gray-600'
            )}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : live ? '● LIVE' : '30d'}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
        {!loading && !live && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Instagram className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-900">
                Connect Instagram to see your real numbers
              </div>
              <div className="mt-0.5 text-xs text-gray-600">
                You're currently viewing sample data. Connect an Instagram Business or Creator
                account linked to a Facebook Page to pull live followers, posts, and engagement.
              </div>
            </div>
            <a
              href={`${backendUrl}/oauth/instagram/start`}
              className="shrink-0 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
            >
              Connect
            </a>
          </div>
        )}

        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="flex flex-col gap-1.5 rounded-2xl border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-[10px] uppercase tracking-wide">{s.label}</span>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="text-xl font-semibold text-gray-900 lg:text-2xl">{s.value}</div>
                <div
                  className={cn(
                    'text-[11px]',
                    s.positive ? 'text-emerald-600' : 'text-rose-600'
                  )}
                >
                  {s.delta}
                </div>
              </div>
            );
          })}
        </div>

        {/* Growth chart — sample for now (IG Graph follower history needs a paid Insights query) */}
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 lg:p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Follower growth</div>
              <div className="text-[11px] text-gray-500">
                +{fmt(trend[trend.length - 1] - trend[0])} over 14 days (sample series)
              </div>
            </div>
            <div className="inline-flex rounded-full border border-gray-200 bg-white p-0.5 text-[11px] font-medium">
              {['14d', '30d', '90d'].map((p, i) => (
                <span
                  key={p}
                  className={cn(
                    'rounded-full px-2.5 py-1',
                    i === 0 ? 'bg-purple-600 text-white' : 'text-gray-500'
                  )}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
          <svg viewBox="0 0 280 80" className="h-24 w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="prof-grow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
              </linearGradient>
            </defs>
            {(() => {
              const pts = trend.map((v, i) => {
                const x = (i / (trend.length - 1)) * 280;
                const y = 80 - ((v - min) / (max - min || 1)) * 70 - 5;
                return [x, y] as const;
              });
              const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
              const area = `${line} L280,80 L0,80 Z`;
              return (
                <>
                  <path d={area} fill="url(#prof-grow)" />
                  <path d={line} fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                </>
              );
            })()}
          </svg>
        </div>

        {/* AI insights */}
        <div className="mt-4 flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            AI insights
          </div>
          {insights.map((ins) => {
            const Icon = ins.icon;
            const isGood = ins.kind === 'good';
            return (
              <div
                key={ins.title}
                className={cn(
                  'flex items-start gap-3 rounded-2xl border p-3',
                  isGood
                    ? 'border-emerald-100 bg-emerald-50/40'
                    : 'border-amber-100 bg-amber-50/40'
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                    isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{ins.title}</div>
                  <div className="text-xs text-gray-600">{ins.detail}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Top posts */}
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {live ? 'Top recent posts' : 'Top posts'}
          </div>
          <ul className="flex flex-col gap-2">
            {topPosts.map((p, idx) => (
              <li
                key={`${p.caption}-${idx}`}
                className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">{p.caption}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                    <span>{p.format}</span>
                    <span>·</span>
                    <span>{live ? 'Interactions' : 'Reach'} {fmt(p.reach)}</span>
                    <span>·</span>
                    <span>Engagement {p.engagement}%</span>
                  </div>
                </div>
              </li>
            ))}
            {live && topPosts.length === 0 && (
              <li className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
                No recent media returned by Instagram yet.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
