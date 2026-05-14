'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Heart,
  Users,
  Clock,
  Lightbulb,
  AlertCircle,
  Instagram,
  Loader2,
  X,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import {
  Skeleton,
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
  // Tap a post tile → opens a full-screen detail modal (caption + engagement
  // + AI take). Stored as the id so we can re-derive from the live profile
  // state if it ever refreshes mid-view.
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

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
            ? `${profile.engagementRate.toFixed(2)}%`
            : '—',
        // Average of (likes+comments)/followers per post. Color thresholds:
        // > 5% green, 2–5% amber, < 2% red — tight bands tuned for IG creator
        // accounts where 2-3% is the typical floor.
        valueClass:
          profile?.engagementRate == null
            ? undefined
            : profile.engagementRate > 5
            ? 'text-emerald-600'
            : profile.engagementRate >= 2
            ? 'text-amber-600'
            : 'text-rose-600',
        delta:
          profile?.engagementRate == null
            ? 'Avg per-post engagement'
            : profile.engagementRate > 5
            ? 'Strong avg per post — above 5%'
            : profile.engagementRate >= 2
            ? 'Typical band — 2-5% per post'
            : 'Below 2% — needs work',
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

  const selectedPost = useMemo(
    () =>
      selectedPostId
        ? (profile?.recentMedia ?? []).find((m) => m.id === selectedPostId) ?? null
        : null,
    [selectedPostId, profile]
  );

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
        {/* Hero — profile pic + handle + bio. Only when IG is connected; the
            "connect" card below carries the empty state when it isn't. */}
        {!loading && live && profile && (
          <div className="mb-4 flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-4 lg:p-5">
            {profile.profilePic ? (
              <img
                src={profile.profilePic}
                alt={profile.handle ?? 'Profile'}
                className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-purple-100 lg:h-20 lg:w-20"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-2xl font-bold text-white ring-2 ring-purple-100 lg:h-20 lg:w-20">
                {(profile.handle ?? '?').replace('@', '').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Instagram className="h-3.5 w-3.5 text-purple-600" />
                <div className="truncate text-sm font-semibold text-gray-900">
                  {profile.handle ?? 'Connected'}
                </div>
              </div>
              <div className="mt-0.5 text-[28px] font-bold leading-none text-gray-900">
                {fmt(profile.followers)}
                <span className="ml-1.5 text-xs font-medium text-gray-500">followers</span>
              </div>
              {profile.bio && (
                <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-gray-600">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        )}

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
            const valueClass = (s as { valueClass?: string }).valueClass ?? 'text-gray-900';
            return (
              <div
                key={s.label}
                className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-4 lg:p-5"
              >
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-[11px] font-medium uppercase tracking-wide">{s.label}</span>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className={cn('text-[28px] font-bold leading-tight tracking-tight lg:text-3xl', valueClass)}>
                  {s.value}
                </div>
                <div className="text-[12px] text-gray-500">{s.delta}</div>
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

        {/* Recent posts grid — 3 columns of thumbnails with engagement overlay.
            Tap → opens the detail modal with caption + breakdown. Matches the
            IG grid mental model so the creator instantly sees what's there. */}
        {live && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Recent posts
              </div>
              <div className="text-[11px] text-gray-400">
                {(profile?.recentMedia?.length ?? 0)} pulled · tap to inspect
              </div>
            </div>
            {(profile?.recentMedia?.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
                No recent media returned by Instagram yet.
              </div>
            ) : (
              <ul className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {(profile?.recentMedia ?? []).map((p) => {
                  const src = p.thumbnailUrl ?? p.mediaUrl;
                  const interactions = p.likeCount + p.commentsCount;
                  // Per-post engagement = (likes + comments) / followers × 100.
                  // Green > 5%, amber 2-5%, red < 2%. Null if followers unknown.
                  const engagementPct =
                    profile?.followers && profile.followers > 0
                      ? (interactions / profile.followers) * 100
                      : null;
                  const pctTone =
                    engagementPct == null
                      ? 'bg-black/55 text-white'
                      : engagementPct > 5
                      ? 'bg-emerald-500 text-white'
                      : engagementPct >= 2
                      ? 'bg-amber-500 text-white'
                      : 'bg-rose-500 text-white';
                  return (
                    <li key={p.id} className="aspect-square">
                      <button
                        type="button"
                        onClick={() => setSelectedPostId(p.id)}
                        className="group relative block h-full w-full overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200 transition-transform active:scale-[0.97]"
                      >
                        {src ? (
                          <img
                            src={src}
                            alt=""
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-opacity group-hover:opacity-95"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                            no media
                          </div>
                        )}
                        {/* Media-type pill, top-left */}
                        <span className="absolute left-1 top-1 inline-flex items-center rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
                          {p.mediaType === 'VIDEO'
                            ? 'REEL'
                            : p.mediaType === 'CAROUSEL_ALBUM'
                            ? 'CAROUSEL'
                            : 'IMAGE'}
                        </span>
                        {/* Per-post engagement %, top-right. Color tells the
                            creator at a glance which posts are pulling weight. */}
                        {engagementPct != null && (
                          <span
                            className={cn(
                              'absolute right-1 top-1 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums shadow-sm',
                              pctTone
                            )}
                          >
                            {engagementPct.toFixed(1)}%
                          </span>
                        )}
                        {/* Likes / comments overlay, bottom */}
                        {interactions > 0 && (
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-2 pb-1.5 pt-3 text-[10px] font-semibold text-white">
                            <span>♥ {fmt(p.likeCount)}</span>
                            <span>💬 {fmt(p.commentsCount)}</span>
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
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

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          followers={profile?.followers ?? null}
          onClose={() => setSelectedPostId(null)}
        />
      )}
    </div>
  );
}

function PostDetailModal({
  post,
  followers,
  onClose,
}: {
  post: IgMedia;
  followers: number | null;
  onClose: () => void;
}) {
  // Lock scroll while the modal is open. Cheap, no portal needed because the
  // modal is fixed-positioned and outranks the page.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const src = post.thumbnailUrl ?? post.mediaUrl;
  const interactions = post.likeCount + post.commentsCount;
  const engagementPct =
    followers && followers > 0 ? (interactions / followers) * 100 : null;
  const tone =
    engagementPct == null
      ? 'text-gray-700'
      : engagementPct > 5
      ? 'text-emerald-600'
      : engagementPct >= 2
      ? 'text-amber-600'
      : 'text-rose-600';
  const verdict =
    engagementPct == null
      ? null
      : engagementPct > 5
      ? 'Outperformed your typical post — the format / topic / hook combination clearly landed. Worth doubling down on this angle for the next piece.'
      : engagementPct >= 2
      ? 'Squarely in the normal 2-5% band. Nothing broken, but no breakout signal — experiment with a tighter hook or a more polarising opening to push it higher.'
      : 'Below the 2% floor. The hook likely failed in the first 2 seconds; rework the opening and post the next piece in your best slot to recover momentum.';

  // Pull caption + hashtags. IG bundles them in caption text; we split.
  const captionRaw = post.caption ?? '';
  const tags = Array.from(new Set(captionRaw.match(/#[\p{L}\p{N}_]+/gu) ?? []));
  const captionWithoutTags = captionRaw.replace(/\s*#[\p{L}\p{N}_]+/gu, '').trim();
  const prompt = `Create a new post that builds on the angle from my piece titled "${captionRaw.slice(0, 80)}". Keep what worked, push it harder.`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm lg:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl lg:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="text-sm font-semibold text-gray-900">Post detail</div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {src && (
            <div className="aspect-square w-full bg-gray-100">
              <img
                src={src}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="flex flex-col gap-4 p-4 lg:p-5">
            {/* Engagement breakdown */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="text-[10px] uppercase tracking-wide text-gray-500">Likes</div>
                <div className="mt-0.5 text-xl font-bold text-gray-900">
                  {post.likeCount.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="text-[10px] uppercase tracking-wide text-gray-500">Comments</div>
                <div className="mt-0.5 text-xl font-bold text-gray-900">
                  {post.commentsCount.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="text-[10px] uppercase tracking-wide text-gray-500">Engagement</div>
                <div className={cn('mt-0.5 text-xl font-bold', tone)}>
                  {engagementPct != null ? `${engagementPct.toFixed(2)}%` : '—'}
                </div>
              </div>
            </div>

            {/* Caption */}
            {captionWithoutTags && (
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Caption
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                  {captionWithoutTags}
                </p>
              </div>
            )}

            {/* Hashtags */}
            {tags.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Hashtags ({tags.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI take — derived from the actual engagement rate, no extra API call */}
            {verdict && (
              <div
                className={cn(
                  'rounded-2xl border p-3.5',
                  engagementPct != null && engagementPct > 5
                    ? 'border-emerald-200 bg-emerald-50/60'
                    : engagementPct != null && engagementPct >= 2
                    ? 'border-gray-200 bg-gray-50'
                    : 'border-rose-200 bg-rose-50/60'
                )}
              >
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-700">
                  <Sparkles className="h-3 w-3" /> AI take
                </div>
                <p className="text-xs leading-relaxed text-gray-800">{verdict}</p>
              </div>
            )}

            {/* Footer actions */}
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/creator/content/scripts?prompt=${encodeURIComponent(prompt)}`}
                onClick={onClose}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#F59E0B] text-sm font-semibold text-black hover:brightness-110"
              >
                <Sparkles className="h-4 w-4" /> Create similar content
              </Link>
              {post.permalink && (
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Open on Instagram <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
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
