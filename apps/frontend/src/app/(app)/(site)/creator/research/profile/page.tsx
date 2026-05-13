'use client';

import { useEffect, useMemo, useState } from 'react';
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
import {
  Skeleton,
  SkeletonList,
  SkeletonStatGrid,
} from '@gitroom/frontend/components/ui/skeleton';
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

interface ContentTypePerf {
  format: 'Reel' | 'Carousel' | 'Image' | 'Story';
  count: number;
  avgInteractions: number;
  avgEngagementPct: number;
}

interface BestTime {
  weekday: string;
  hour: number;
  avgInteractions: number;
  posts: number;
}

interface FollowerTrendPoint {
  date: string;
  count: number;
}

interface RealInsight {
  kind: 'good' | 'warn';
  title: string;
  detail: string;
}

interface AiInsightCard {
  title: string;
  detail: string;
  suggestedPrompt: string;
}

interface AiInsights {
  connected: boolean;
  generatedAt: string | null;
  contentDna: AiInsightCard[];
  growthOpportunities: AiInsightCard[];
  audiencePulse: AiInsightCard[];
  contentGaps: AiInsightCard[];
}

interface Insights {
  connected: boolean;
  engagementRate: number | null;
  contentTypePerformance: ContentTypePerf[];
  bestTimes: BestTime[];
  followerTrend: FollowerTrendPoint[];
  insights: RealInsight[];
}

const fmt = (n: number | null | undefined) => {
  if (n == null) return '—';
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
    : `${n}`;
};

const formatBestTime = (t: BestTime) => {
  const hour12 = t.hour % 12 || 12;
  const meridiem = t.hour >= 12 ? 'PM' : 'AM';
  return `${t.weekday} ${hour12}:00 ${meridiem}`;
};

export default function CreatorProfile() {
  const fetch = useFetch();
  const { backendUrl } = useVariables();
  const [profile, setProfile] = useState<IgProfile | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [ai, setAi] = useState<AiInsights | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pRes, iRes] = await Promise.all([
          fetch('/creator/profile'),
          fetch('/creator/insights'),
        ]);
        if (!cancelled) {
          if (pRes.ok) setProfile(await pRes.json());
          if (iRes.ok) setInsights(await iRes.json());
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

  // AI Content DNA: fire-and-forget after the page renders. Cached server-side
  // for 30 minutes so reloads are instant after the first call.
  useEffect(() => {
    if (!profile?.connected) return;
    let cancelled = false;
    setAiLoading(true);
    (async () => {
      try {
        const res = await fetch('/creator/ai-insights');
        if (!cancelled && res.ok) {
          setAi((await res.json()) as AiInsights);
        }
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetch, profile?.connected]);

  const live = profile?.connected ?? false;

  const stats = useMemo(() => {
    if (!live) {
      return [
        { label: 'Followers', value: '—', delta: 'Connect IG to see live', positive: true, icon: Users },
        { label: 'Engagement', value: '—', delta: 'Connect IG to see live', positive: true, icon: Heart },
        { label: 'Posts', value: '—', delta: 'Connect IG to see live', positive: true, icon: TrendingUp },
        { label: 'Best time', value: '—', delta: 'Connect IG to see live', positive: true, icon: Clock },
      ];
    }
    const bestTime = insights?.bestTimes[0]
      ? formatBestTime(insights.bestTimes[0])
      : '—';
    return [
      {
        label: 'Followers',
        value: fmt(profile?.followers),
        delta: 'Live from Instagram',
        positive: true,
        icon: Users,
      },
      {
        label: 'Engagement',
        value:
          profile?.engagementRate != null
            ? `${profile.engagementRate}%`
            : '—',
        delta: 'Across recent posts',
        positive: true,
        icon: Heart,
      },
      {
        label: 'Posts',
        value: fmt(profile?.mediaCount),
        delta: 'Total on profile',
        positive: true,
        icon: TrendingUp,
      },
      {
        label: 'Best time',
        value: bestTime,
        delta:
          insights?.bestTimes[0]
            ? `${insights.bestTimes[0].avgInteractions.toLocaleString()} avg interactions`
            : 'Need more posts',
        positive: true,
        icon: Clock,
      },
    ];
  }, [live, profile, insights]);

  const topPosts = useMemo(() => {
    if (!live) return [];
    return [...(profile?.recentMedia ?? [])]
      .sort(
        (a, b) =>
          b.likeCount + b.commentsCount - (a.likeCount + a.commentsCount)
      )
      .slice(0, 3);
  }, [live, profile]);

  const trend = insights?.followerTrend ?? [];
  const trendValues = trend.map((p) => p.count);
  const max = trendValues.length ? Math.max(...trendValues) : 0;
  const min = trendValues.length ? Math.min(...trendValues) : 0;
  const growthDelta =
    trendValues.length > 1 ? trendValues[trendValues.length - 1] - trendValues[0] : 0;

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 lg:px-8 lg:py-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-gray-900">My Profile</div>
            <div className="truncate text-xs text-gray-500">
              {live && profile?.handle
                ? `${profile.handle} · live from Instagram`
                : 'Connect Instagram to see live data'}
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
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : live ? (
              '● LIVE'
            ) : (
              'Not connected'
            )}
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
                Connect an Instagram Business or Creator account linked to a Facebook Page to pull live followers, posts, and engagement.
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

        {loading ? (
          <>
            <SkeletonStatGrid count={4} />
            <div className="mt-4"><Skeleton className="h-32 w-full rounded-2xl" /></div>
            <div className="mt-4 flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          </>
        ) : null}

        {/* Stat tiles */}
        {!loading && (
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
                <div className="text-[11px] text-emerald-600">{s.delta}</div>
              </div>
            );
          })}
        </div>
        )}

        {!loading && (
        <>
        {/* Follower growth — real series from IG /insights when available */}
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 lg:p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Follower growth</div>
              <div className="text-[11px] text-gray-500">
                {trend.length > 0
                  ? `${growthDelta >= 0 ? '+' : ''}${fmt(growthDelta)} over ${trend.length} day${trend.length === 1 ? '' : 's'} (live)`
                  : live
                  ? 'IG /insights returned no follower history yet — check back tomorrow.'
                  : 'Connect Instagram to see live follower trend.'}
              </div>
            </div>
          </div>
          {trend.length >= 2 ? (
            <svg viewBox="0 0 280 80" className="h-24 w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="prof-grow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
                </linearGradient>
              </defs>
              {(() => {
                const pts = trendValues.map((v, i) => {
                  const x = (i / (trendValues.length - 1)) * 280;
                  const y = 80 - ((v - min) / (max - min || 1)) * 70 - 5;
                  return [x, y] as const;
                });
                const line = pts
                  .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`)
                  .join(' ');
                const area = `${line} L280,80 L0,80 Z`;
                return (
                  <>
                    <path d={area} fill="url(#prof-grow)" />
                    <path
                      d={line}
                      fill="none"
                      stroke="#7C3AED"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </>
                );
              })()}
            </svg>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-400">
              {live ? 'Not enough datapoints yet — IG insights builds the series day by day' : '—'}
            </div>
          )}
        </div>

        {/* AI insights — computed from real posts */}
        <div className="mt-4 flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Insights
          </div>
          {(insights?.insights ?? []).map((ins, i) => {
            const Icon = ins.kind === 'good' ? Lightbulb : AlertCircle;
            const isGood = ins.kind === 'good';
            return (
              <div
                key={i}
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
          {(insights?.insights?.length ?? 0) === 0 && live && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
              Computing insights from your recent posts…
            </div>
          )}
        </div>

        {/* AI Content DNA — Claude analyses your real posts */}
        {live && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-700">
                  <Lightbulb className="h-3 w-3" /> AI analysis · powered by Claude
                </div>
                {ai?.generatedAt && (
                  <div className="text-[10px] text-gray-400">
                    Generated {new Date(ai.generatedAt).toLocaleString()}
                  </div>
                )}
              </div>
              <button
                disabled={aiLoading}
                onClick={async () => {
                  setAiLoading(true);
                  try {
                    const r = await fetch('/creator/ai-insights?refresh=1');
                    if (r.ok) setAi(await r.json());
                  } finally {
                    setAiLoading(false);
                  }
                }}
                className="text-[11px] font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50"
              >
                {aiLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {aiLoading && !ai && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            )}

            {ai && (
              <div className="flex flex-col gap-4">
                <AiInsightGroup label="Your content DNA" cards={ai.contentDna} accent="#7C3AED" />
                <AiInsightGroup label="Growth opportunities" cards={ai.growthOpportunities} accent="#F59E0B" />
                <AiInsightGroup label="Audience pulse" cards={ai.audiencePulse} accent="#10B981" />
                <AiInsightGroup label="Content gaps" cards={ai.contentGaps} accent="#EF4444" />
              </div>
            )}
          </div>
        )}

        {/* Content type performance */}
        {live && (insights?.contentTypePerformance?.length ?? 0) > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              By content type
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(insights?.contentTypePerformance ?? []).map((c) => (
                <div
                  key={c.format}
                  className="rounded-2xl border border-gray-200 bg-white p-4"
                >
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">
                    {c.format} · {c.count} post{c.count === 1 ? '' : 's'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">
                    {c.avgInteractions.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-gray-500">avg interactions</div>
                  <div className="mt-1 text-[11px] text-emerald-600">
                    {c.avgEngagementPct}% engagement
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top posts */}
        {live && (
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Top recent posts
            </div>
            <ul className="flex flex-col gap-2">
              {topPosts.map((p, idx) => (
                <li
                  key={p.id}
                  className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                    {idx + 1}
                  </div>
                  {p.thumbnailUrl || p.mediaUrl ? (
                    <img
                      src={p.thumbnailUrl ?? p.mediaUrl ?? ''}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-medium text-gray-900">
                      {p.caption ?? '(no caption)'}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                      <span>{p.mediaType === 'VIDEO' ? 'Reel' : p.mediaType === 'CAROUSEL_ALBUM' ? 'Carousel' : 'Image'}</span>
                      <span>·</span>
                      <span>♥ {fmt(p.likeCount)}</span>
                      <span>·</span>
                      <span>💬 {fmt(p.commentsCount)}</span>
                    </div>
                  </div>
                </li>
              ))}
              {topPosts.length === 0 && (
                <li className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
                  No recent media returned by Instagram yet.
                </li>
              )}
            </ul>
          </div>
        )}
        </>
        )}

        {/* Next-step CTA — completes the Content pipeline guidance */}
        {!loading && (
          <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">
                Next: turn these insights into a script
              </div>
              <div className="text-xs text-gray-600">
                Your AI manager will use this profile analysis + competitor
                signals to draft a piece tailored to your audience.
              </div>
            </div>
            <a
              href="/creator/content/scripts"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#F59E0B] px-4 text-sm font-semibold text-black hover:brightness-110"
            >
              Start creating →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function AiInsightGroup({
  label,
  cards,
  accent,
}: {
  label: string;
  cards: AiInsightCard[];
  accent: string;
}) {
  if (!cards || cards.length === 0) return null;
  return (
    <div>
      <div
        className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: accent }}
      >
        {label}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {cards.map((c, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4"
            style={{ borderLeft: `3px solid ${accent}` }}
          >
            <div className="text-sm font-semibold text-gray-900">{c.title}</div>
            <div className="text-xs leading-relaxed text-gray-600">{c.detail}</div>
            {c.suggestedPrompt && (
              <a
                href={`/creator/content/scripts?prompt=${encodeURIComponent(c.suggestedPrompt)}`}
                className="mt-1 inline-flex items-center gap-1 self-start rounded-full px-3 py-1 text-[11px] font-semibold transition-colors"
                style={{
                  backgroundColor: `${accent}22`,
                  color: accent,
                }}
              >
                Act on this →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
