'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Eye,
  Heart,
  MessageSquare,
  Sparkles,
  Instagram,
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  RefreshCw,
  Crown,
  Hash,
  Clock,
  Lightbulb,
  AlertCircle,
  Trophy,
} from 'lucide-react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import {
  Skeleton,
  SkeletonStatGrid,
  SkeletonList,
} from '@gitroom/frontend/components/ui/skeleton';
import { cn } from '@gitroom/frontend/lib/utils';
import {
  useCreatorProfile,
  useCreatorInsights,
  useWeeklyReport,
  useIntelligence,
} from '@gitroom/frontend/hooks/creator-data';
import { usePrefs } from '@gitroom/frontend/components/layout/prefs.context';

// ---------------------------------------------------------------------------
// Types — mirror the API payloads so the page can be picked apart cheaply.
// ---------------------------------------------------------------------------

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

interface Insights {
  connected: boolean;
  engagementRate: number | null;
  contentTypePerformance: ContentTypePerf[];
  bestTimes: BestTime[];
  followerTrend: FollowerTrendPoint[];
}

interface WeeklyReport {
  connected: boolean;
  generatedAt: string | null;
  periodLabel: string;
  postsLast7Days: number;
  recapHeadline: string;
  whatWorked: string[];
  whatDidnt: string[];
  recommendations: string[];
  bestTimeToPost: string;
  formatBreakdown: Array<{ format: string; count: number; avgInteractions: number; verdict: string }>;
  topHashtags: Array<{ tag: string; uses: number; avgInteractions: number }>;
  partial?: boolean;
}

interface PostingSlot {
  day: string;
  time: string;
  avgEngagement: number;
}

interface FormatStat {
  count: number;
  avgEngagement: number;
  trend: 'up' | 'down' | 'stable';
}

interface HashtagStat {
  hashtag: string;
  avgReach: number;
  frequency: number;
}

interface Intelligence {
  connected: boolean;
  generatedAt: string | null;
  bestPostingTimes: PostingSlot[];
  worstPostingTimes: PostingSlot[];
  optimalFrequency: string;
  contentBreakdown: {
    reels: FormatStat;
    posts: FormatStat;
    carousels: FormatStat;
    stories: FormatStat;
  };
  topPerformingType: 'reels' | 'posts' | 'carousels' | 'stories' | null;
  hashtagEffectiveness: HashtagStat[];
  recommendedHashtags: string[];
  overusedHashtags: string[];
  audienceActiveHours: Array<{ hour: number; engagement: 'high' | 'medium' | 'low' }>;
  growthRate: string;
  growthTrend: 'accelerating' | 'steady' | 'declining' | 'unknown';
  projectedFollowers30Days: number | null;
  avgEngagementRate: number;
  engagementTrend: 'improving' | 'stable' | 'declining';
  profileHealthScore: number;
  avgCaptionLength: number;
  bestCaptionStyle: string;
  emojiUsage: string;
  topEngagementDrivers: string[];
  engagementKillers: string[];
}

type SortKey = 'recent' | 'likes' | 'comments' | 'engagement';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
    : `${n}`;

const fmtSigned = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}`;

const fmtAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400_000);
  if (d < 1) return 'today';
  if (d === 1) return '1 day ago';
  if (d < 30) return `${d} days ago`;
  if (d < 60) return '1 month ago';
  return `${Math.floor(d / 30)} months ago`;
};

const engagementOf = (m: IgMedia, followers: number | null): number | null => {
  if (!followers || followers <= 0) return null;
  return ((m.likeCount + m.commentsCount) / followers) * 100;
};

const engagementTone = (pct: number | null) => {
  if (pct == null) return 'bg-gray-100 text-gray-700';
  if (pct > 5) return 'bg-emerald-100 text-emerald-700';
  if (pct >= 2) return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
};

const mediaTypeLabel = (t: string) =>
  t === 'VIDEO' ? 'Reel' : t === 'CAROUSEL_ALBUM' ? 'Carousel' : t === 'STORY' ? 'Story' : 'Image';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CreatorAnalyticsPage() {
  const fetch = useFetch();
  const { backendUrl } = useVariables();
  const { aiAgentName: aiName } = usePrefs();
  const [sort, setSort] = useState<SortKey>('recent');

  const { data: profile, isLoading: profileLoading } = useCreatorProfile();
  const { data: insights } = useCreatorInsights();
  const connected = profile?.connected ?? false;
  const {
    data: report,
    isLoading: reportLoading,
    mutate: mutateReport,
  } = useWeeklyReport(connected);
  const { data: intel } = useIntelligence(connected);

  const loading = profileLoading;

  const live = profile?.connected ?? false;
  const followers = profile?.followers ?? null;

  const media = useMemo(
    () =>
      live
        ? [...(profile?.recentMedia ?? [])].sort(
            (a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)
          )
        : [],
    [live, profile]
  );

  // Summary: last 30 days. Most creators post a few times a week so 30d is
  // the meaningful "reach over recent activity" window.
  const last30 = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400_000;
    return media.filter((m) => +new Date(m.timestamp) >= cutoff);
  }, [media]);

  const totals = useMemo(() => {
    const likes = last30.reduce((s, m) => s + m.likeCount, 0);
    const comments = last30.reduce((s, m) => s + m.commentsCount, 0);
    return { likes, comments, interactions: likes + comments, posts: last30.length };
  }, [last30]);

  // Week-over-week comparison — last 7 days vs the 7 days before that.
  // Lets the creator see momentum at a glance without scrolling charts.
  const weekly = useMemo(() => {
    const now = Date.now();
    const day = 86_400_000;
    const sliceWindow = (start: number, end: number) =>
      media.filter((m) => {
        const t = +new Date(m.timestamp);
        return t >= start && t < end;
      });
    const thisWeek = sliceWindow(now - 7 * day, now);
    const prior = sliceWindow(now - 14 * day, now - 7 * day);
    const sum = (arr: typeof media) => ({
      posts: arr.length,
      likes: arr.reduce((s, m) => s + m.likeCount, 0),
      comments: arr.reduce((s, m) => s + m.commentsCount, 0),
      interactions: arr.reduce((s, m) => s + m.likeCount + m.commentsCount, 0),
      avgEng:
        followers && followers > 0 && arr.length > 0
          ? (arr.reduce((s, m) => s + m.likeCount + m.commentsCount, 0) /
              arr.length /
              followers) *
            100
          : 0,
    });
    return { thisWeek: sum(thisWeek), prior: sum(prior) };
  }, [media, followers]);

  // Canonical engagement = the same number the Profile page tile uses.
  // Formula on the server (instagram.ts):
  //   (sum of likes + comments over the last 12 posts) / (followers × 12) × 100
  // Recomputing here over `last30` produced a different number when the
  // creator hadn't posted in the last 30 days — Profile said 1.85%, Analytics
  // said 74%, both right by their own definition but inconsistent. Use the
  // server number directly everywhere.
  const avgEngagement = profile?.engagementRate ?? null;

  const bestPost = useMemo(() => {
    if (media.length === 0) return null;
    return [...media].sort(
      (a, b) =>
        b.likeCount + b.commentsCount - (a.likeCount + a.commentsCount)
    )[0];
  }, [media]);

  // Growth = first-to-last delta over the API-provided trend window (the IG
  // /insights endpoint emits a daily series). Falls back to interactions
  // momentum when no follower history is available.
  const growth = useMemo(() => {
    const trend = insights?.followerTrend ?? [];
    if (trend.length >= 2) {
      const first = trend[0].count;
      const last = trend[trend.length - 1].count;
      return { delta: last - first, label: `${trend.length} day${trend.length === 1 ? '' : 's'}` };
    }
    return null;
  }, [insights]);

  const sortedMedia = useMemo(() => {
    const list = [...media];
    switch (sort) {
      case 'likes':
        return list.sort((a, b) => b.likeCount - a.likeCount);
      case 'comments':
        return list.sort((a, b) => b.commentsCount - a.commentsCount);
      case 'engagement':
        return list.sort(
          (a, b) => (engagementOf(b, followers) ?? 0) - (engagementOf(a, followers) ?? 0)
        );
      default:
        return list; // already sorted recent-first
    }
  }, [media, sort, followers]);

  const refreshReport = async () => {
    // Bypass the server cache; once we have the fresh payload patch it into
    // SWR's local cache so the UI updates without an extra round-trip.
    const r = await fetch('/creator/weekly-report?refresh=1');
    if (r.ok) {
      const fresh = (await r.json()) as WeeklyReport;
      await mutateReport(fresh, { revalidate: false });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-2 px-4 py-3 lg:px-8 lg:py-5">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-gray-900">Analytics</div>
            <div className="truncate text-xs text-gray-500">
              {live && profile?.handle
                ? `${profile.handle} · ${totals.posts} posts in the last 30 days`
                : 'Connect Instagram to see live analytics'}
            </div>
          </div>
          <span
            className={cn(
              'inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-medium',
              live ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600'
            )}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : live ? '● LIVE' : 'Not connected'}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
        {!loading && !live && <ConnectPrompt backendUrl={backendUrl} />}

        {loading && (
          // First-paint skeleton — kept compact so the page reveals as data
          // arrives instead of feeling like a wall of grey blocks. Each real
          // section also shows its own loading state once we have the
          // profile but the AI calls are still in flight.
          <>
            <SkeletonStatGrid count={4} />
            <div className="mt-4">
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          </>
        )}

        {!loading && live && (
          <>
            {/* Top summary cards */}
            <SummaryGrid
              reachLast30={totals.interactions}
              avgEngagement={avgEngagement}
              bestPost={bestPost}
              followers={followers}
              growth={growth}
            />

            {/* Week-over-week comparison — high-signal "are you trending up" panel */}
            <WeekOverWeek thisWeek={weekly.thisWeek} prior={weekly.prior} />

            {/* Best-performing post — big card, CTA to remix */}
            {bestPost && <BestPostCard post={bestPost} followers={followers} />}

            {/* Caption insights from intel — surface what's working in the text */}
            {intel && (intel.avgCaptionLength > 0 || intel.bestCaptionStyle || intel.emojiUsage) && (
              <CaptionInsights
                avgLength={intel.avgCaptionLength}
                bestStyle={intel.bestCaptionStyle}
                emojiUsage={intel.emojiUsage}
                drivers={intel.topEngagementDrivers ?? []}
                killers={intel.engagementKillers ?? []}
              />
            )}

            {/* AI Weekly report */}
            <WeeklyReportPanel
              report={report}
              loading={reportLoading && !report}
              onRefresh={refreshReport}
              refreshing={reportLoading && !!report}
              aiName={aiName}
            />

            {/* Format bar chart — engagement % per format, sorted */}
            {intel && (
              <FormatBarChart breakdown={intel.contentBreakdown} top={intel.topPerformingType} />
            )}

            {/* Best-times heatmap — 7×24 grid powered by intel */}
            {intel && intel.bestPostingTimes.length > 0 && (
              <HeatmapCard
                best={intel.bestPostingTimes}
                worst={intel.worstPostingTimes}
                active={intel.audienceActiveHours}
              />
            )}

            {/* Growth chart — follower trend if we have it, else engagement
                over the last 12 posts as a fallback */}
            <GrowthChart
              followerTrend={insights?.followerTrend ?? []}
              media={media}
              followers={followers}
              projected30={intel?.projectedFollowers30Days ?? null}
            />

            {/* Hashtag cloud — bubble size = avg reach */}
            {intel && intel.hashtagEffectiveness.length > 0 && (
              <HashtagCloud
                stats={intel.hashtagEffectiveness}
                recommended={intel.recommendedHashtags}
                overused={intel.overusedHashtags}
              />
            )}

            {/* Content-type breakdown — kept for the raw numbers; the bar
                chart above is the headline view */}
            {insights && insights.contentTypePerformance.length > 0 && (
              <FormatBreakdown perfs={insights.contentTypePerformance} />
            )}

            {/* Post performance list */}
            <PostList
              media={sortedMedia}
              followers={followers}
              sort={sort}
              onSort={setSort}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connect prompt
// ---------------------------------------------------------------------------

function ConnectPrompt({ backendUrl }: { backendUrl: string }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <Instagram className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-900">
          Connect Instagram to see real post analytics
        </div>
        <div className="mt-0.5 text-xs text-gray-600">
          We'll pull likes, comments, engagement, and best-time data for every recent post.
        </div>
      </div>
      <a
        href={`${backendUrl}/oauth/instagram/start`}
        className="shrink-0 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
      >
        Connect
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary grid
// ---------------------------------------------------------------------------

function SummaryGrid({
  reachLast30,
  avgEngagement,
  bestPost,
  followers,
  growth,
}: {
  reachLast30: number;
  avgEngagement: number | null;
  bestPost: IgMedia | null;
  followers: number | null;
  growth: { delta: number; label: string } | null;
}) {
  const engTone =
    avgEngagement == null
      ? 'text-gray-900'
      : avgEngagement > 5
      ? 'text-emerald-600'
      : avgEngagement >= 2
      ? 'text-amber-600'
      : 'text-rose-600';

  const bestPct = bestPost ? engagementOf(bestPost, followers) : null;

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
      <StatCard
        label="Total interactions"
        sublabel="last 30 days"
        value={fmt(reachLast30)}
        icon={Eye}
      />
      <StatCard
        label="Avg engagement"
        sublabel="per post"
        value={avgEngagement != null ? `${avgEngagement.toFixed(2)}%` : '—'}
        valueClass={engTone}
        icon={Heart}
      />
      <StatCard
        label="Followers"
        sublabel={
          growth
            ? `${fmtSigned(growth.delta)} over ${growth.label}`
            : followers
            ? 'Live from Instagram'
            : 'Need IG insights'
        }
        value={followers != null ? fmt(followers) : '—'}
        icon={TrendingUp}
        valueClass={growth && growth.delta >= 0 ? 'text-emerald-600' : growth && growth.delta < 0 ? 'text-rose-600' : undefined}
      />
      <StatCard
        label="Best post"
        sublabel={bestPct != null ? `${bestPct.toFixed(2)}% engagement` : 'No recent posts'}
        value={bestPost ? `${fmt(bestPost.likeCount + bestPost.commentsCount)}` : '—'}
        icon={Crown}
        thumbnail={bestPost?.thumbnailUrl ?? bestPost?.mediaUrl ?? undefined}
      />
    </div>
  );
}

function StatCard({
  label,
  sublabel,
  value,
  valueClass,
  icon: Icon,
  thumbnail,
}: {
  label: string;
  sublabel?: string;
  value: string;
  valueClass?: string;
  icon: typeof Eye;
  thumbnail?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between text-gray-500">
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            className="h-6 w-6 rounded object-cover"
          />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
      </div>
      <div className={cn('text-xl font-semibold leading-tight text-gray-900 lg:text-2xl', valueClass)}>
        {value}
      </div>
      {sublabel && <div className="text-[11px] text-gray-500">{sublabel}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week-over-week comparison
// ---------------------------------------------------------------------------

interface WeekSlice {
  posts: number;
  likes: number;
  comments: number;
  interactions: number;
  avgEng: number;
}

function WeekOverWeek({ thisWeek, prior }: { thisWeek: WeekSlice; prior: WeekSlice }) {
  if (thisWeek.posts === 0 && prior.posts === 0) return null;
  const items: Array<{ label: string; now: number; was: number; fmt: (n: number) => string }> = [
    { label: 'Posts', now: thisWeek.posts, was: prior.posts, fmt: (n) => `${n}` },
    { label: 'Interactions', now: thisWeek.interactions, was: prior.interactions, fmt },
    { label: 'Likes', now: thisWeek.likes, was: prior.likes, fmt },
    { label: 'Comments', now: thisWeek.comments, was: prior.comments, fmt },
    {
      label: 'Avg engagement',
      now: thisWeek.avgEng,
      was: prior.avgEng,
      fmt: (n) => `${n.toFixed(2)}%`,
    },
  ];
  return (
    <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-900">This week vs last</div>
          <div className="text-[11px] text-gray-500">
            Trailing 7 days compared to the 7 before that
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-gray-400">
          Live · last 14 days
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((it) => {
          const diff = it.was === 0 ? (it.now > 0 ? 100 : 0) : ((it.now - it.was) / it.was) * 100;
          const up = diff > 0;
          const flat = Math.abs(diff) < 1;
          const tone = flat ? 'text-gray-500' : up ? 'text-emerald-600' : 'text-rose-600';
          const bg = flat ? 'bg-gray-100' : up ? 'bg-emerald-50' : 'bg-rose-50';
          return (
            <div key={it.label} className="rounded-xl border border-gray-200 p-3">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">{it.label}</div>
              <div className="mt-0.5 text-lg font-semibold text-gray-900 tabular-nums">
                {it.fmt(it.now)}
              </div>
              <div className={cn('mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', bg, tone)}>
                {flat ? (
                  <span>flat</span>
                ) : up ? (
                  <>
                    <TrendingUp className="h-3 w-3" />
                    {`+${Math.abs(diff).toFixed(0)}%`}
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3" />
                    {`-${Math.abs(diff).toFixed(0)}%`}
                  </>
                )}
                <span className="font-normal text-gray-500">vs {it.fmt(it.was)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Caption insights — what AI saw working in the writing
// ---------------------------------------------------------------------------

function CaptionInsights({
  avgLength,
  bestStyle,
  emojiUsage,
  drivers,
  killers,
}: {
  avgLength: number;
  bestStyle: string;
  emojiUsage: string;
  drivers: string[];
  killers: string[];
}) {
  const lengthBand =
    avgLength < 80 ? 'short' : avgLength < 200 ? 'medium' : avgLength < 500 ? 'long' : 'essay';
  return (
    <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-gray-900">Caption insights</div>
        <div className="text-[11px] text-gray-500">
          What AI noticed about your writing across recent posts
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Avg length</div>
          <div className="mt-0.5 text-lg font-semibold text-gray-900">
            {avgLength > 0 ? `${Math.round(avgLength)} chars` : '—'}
          </div>
          <div className="mt-0.5 text-[11px] capitalize text-gray-500">{lengthBand}</div>
        </div>
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Best style</div>
          <div className="mt-0.5 line-clamp-2 text-sm font-semibold text-gray-900">
            {bestStyle || '—'}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Emoji usage</div>
          <div className="mt-0.5 line-clamp-2 text-sm font-semibold text-gray-900">
            {emojiUsage || '—'}
          </div>
        </div>
      </div>
      {(drivers.length > 0 || killers.length > 0) && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {drivers.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                <TrendingUp className="h-3 w-3" /> What drives engagement
              </div>
              <ul className="ml-3 list-disc text-[11px] leading-relaxed text-gray-800">
                {drivers.slice(0, 4).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          {killers.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                <TrendingDown className="h-3 w-3" /> What kills engagement
              </div>
              <ul className="ml-3 list-disc text-[11px] leading-relaxed text-gray-800">
                {killers.slice(0, 4).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Best post card
// ---------------------------------------------------------------------------

function BestPostCard({
  post,
  followers,
}: {
  post: IgMedia;
  followers: number | null;
}) {
  const interactions = post.likeCount + post.commentsCount;
  const pct = engagementOf(post, followers);
  const captionFragment = (post.caption ?? '').slice(0, 80) || '(no caption)';
  const remixPrompt = `Create a new post that builds on the angle from my piece titled "${captionFragment.slice(0, 80)}". Keep what worked, push it harder.`;

  return (
    <div className="mt-4 flex flex-col items-start gap-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 lg:flex-row lg:items-center">
      <div className="flex shrink-0 items-center gap-3">
        {(post.thumbnailUrl || post.mediaUrl) && (
          <img
            src={post.thumbnailUrl ?? post.mediaUrl ?? ''}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            className="h-20 w-20 shrink-0 rounded-xl object-cover ring-2 ring-amber-200"
          />
        )}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 lg:hidden">
          <Trophy className="h-4 w-4" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
          <Trophy className="hidden h-3 w-3 lg:inline" /> Best performing post
        </div>
        <div className="mt-1 line-clamp-2 text-sm font-semibold text-gray-900">
          {captionFragment}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
          <span>{mediaTypeLabel(post.mediaType)}</span>
          <span>·</span>
          <span>{fmtAgo(post.timestamp)}</span>
          <span>·</span>
          <span>♥ {fmt(post.likeCount)} · 💬 {fmt(post.commentsCount)}</span>
          {pct != null && (
            <>
              <span>·</span>
              <span className={cn('font-semibold', pct > 5 ? 'text-emerald-700' : pct >= 2 ? 'text-amber-700' : 'text-rose-700')}>
                {pct.toFixed(2)}% engagement
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2 lg:w-auto lg:flex-row">
        <Link
          href={`/creator/content/scripts?prompt=${encodeURIComponent(remixPrompt)}`}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#F59E0B] px-4 text-xs font-semibold text-black hover:brightness-110"
        >
          <Sparkles className="h-3.5 w-3.5" /> Create similar
        </Link>
        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          >
            Open on IG <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI weekly report
// ---------------------------------------------------------------------------

function WeeklyReportPanel({
  report,
  loading,
  onRefresh,
  refreshing,
  aiName,
}: {
  report: WeeklyReport | null;
  loading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  aiName: string;
}) {
  const partial = report?.partial === true;
  return (
    <section className="mt-5 rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-purple-700">
            <Sparkles className="h-3 w-3" /> Your week in review · by {aiName}
          </div>
          {report?.periodLabel && (
            <div className="text-[11px] text-gray-500">{report.periodLabel} · {report.postsLast7Days} post{report.postsLast7Days === 1 ? '' : 's'}</div>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading || refreshing}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-purple-200 bg-white px-3 text-[11px] font-medium text-purple-700 hover:border-purple-300 disabled:opacity-50"
        >
          {refreshing || loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {partial && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <span className="font-semibold">AI recap took too long this time.</span> The numbers below are real; tap Refresh to regenerate the narrative.
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      )}

      {!loading && report && (
        <div className="flex flex-col gap-3">
          {report.recapHeadline && (
            <p className="text-sm font-semibold text-gray-900">{report.recapHeadline}</p>
          )}

          {report.whatWorked.length > 0 && (
            <ReportBlock
              icon={Lightbulb}
              label="What worked"
              accent="emerald"
              items={report.whatWorked}
            />
          )}
          {report.whatDidnt.length > 0 && (
            <ReportBlock
              icon={AlertCircle}
              label="What didn't"
              accent="rose"
              items={report.whatDidnt}
            />
          )}
          {report.recommendations.length > 0 && (
            <ReportBlock
              icon={Sparkles}
              label="Next week"
              accent="purple"
              items={report.recommendations}
            />
          )}

          {(report.bestTimeToPost || report.formatBreakdown.length > 0) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {report.bestTimeToPost && (
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    <Clock className="h-3 w-3" /> Best time to post
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {report.bestTimeToPost}
                  </div>
                </div>
              )}
              {report.formatBreakdown.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Format performance
                  </div>
                  <ul className="mt-1 flex flex-col gap-0.5 text-[11px] text-gray-700">
                    {report.formatBreakdown.map((f) => (
                      <li key={f.format}>
                        <span className="font-semibold text-gray-900">{f.format}</span>
                        <span className="text-gray-500"> · n={f.count} · {f.avgInteractions.toLocaleString()} avg</span>
                        <span className="ml-1 text-gray-500">— {f.verdict}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {report.topHashtags.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                <Hash className="h-3 w-3" /> Highest-impact hashtags
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {report.topHashtags.map((h) => (
                  <span
                    key={h.tag}
                    className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-700"
                  >
                    {h.tag}
                    <span className="text-purple-400">·</span>
                    <span className="text-purple-600">{h.avgInteractions.toLocaleString()}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !report && (
        <div className="rounded-xl border border-dashed border-purple-200 bg-white/60 p-3 text-xs text-gray-600">
          AI recap not available yet — hit Refresh to generate one.
        </div>
      )}
    </section>
  );
}

function ReportBlock({
  icon: Icon,
  label,
  accent,
  items,
}: {
  icon: typeof Sparkles;
  label: string;
  accent: 'emerald' | 'rose' | 'purple';
  items: string[];
}) {
  // Accent shows only on the left border + icon — body copy stays the same
  // dark gray everywhere so nothing reads as washed-out against the panel's
  // tinted background.
  const tones = {
    emerald: { border: 'border-emerald-300', tint: 'bg-emerald-50/60', icon: 'text-emerald-700' },
    rose: { border: 'border-rose-300', tint: 'bg-rose-50/60', icon: 'text-rose-700' },
    purple: { border: 'border-purple-300', tint: 'bg-purple-50/60', icon: 'text-purple-700' },
  } as const;
  const t = tones[accent];
  return (
    <div className={cn('rounded-xl border-l-4 border-y border-r p-3', t.border, t.tint)}>
      <div className={cn('flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-900')}>
        <Icon className={cn('h-3 w-3', t.icon)} /> {label}
      </div>
      <ul className="mt-1.5 ml-3 list-disc text-xs leading-relaxed text-gray-900">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Growth chart — sparkline + interactive data points
// ---------------------------------------------------------------------------

function GrowthChart({
  followerTrend,
  media,
  followers,
  projected30,
}: {
  followerTrend: FollowerTrendPoint[];
  media: IgMedia[];
  followers: number | null;
  projected30?: number | null;
}) {
  // Prefer real follower history; fall back to per-post engagement so the
  // chart isn't blank just because IG insights returned nothing.
  const usingFollowers = followerTrend.length >= 2;
  const points = usingFollowers
    ? followerTrend.map((p, i) => ({ id: `${p.date}-${i}`, label: p.date, value: p.count }))
    : [...media]
        .slice(0, 12)
        .reverse()
        .map((m, i) => ({
          id: m.id ?? `${i}`,
          label: new Date(m.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
          value: engagementOf(m, followers) ?? m.likeCount + m.commentsCount,
        }));

  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (points.length < 2) {
    return null;
  }

  const max = Math.max(...points.map((p) => p.value));
  const min = Math.min(...points.map((p) => p.value));
  const range = Math.max(max - min, 1);

  // SVG plot — 100% width × fixed 110 height. Points are tap targets via
  // invisible circles so the tooltip works on mobile.
  const W = 320;
  const H = 110;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - 10 - ((p.value - min) / range) * (H - 20);
    return { ...p, x, y };
  });
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const active = activeIdx != null ? coords[activeIdx] : null;
  const delta =
    usingFollowers && coords.length >= 2
      ? coords[coords.length - 1].value - coords[0].value
      : null;

  return (
    <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            {usingFollowers ? 'Follower growth' : 'Engagement trend'}
          </div>
          <div className="text-[11px] text-gray-500">
            {usingFollowers
              ? delta != null
                ? `${delta >= 0 ? '+' : ''}${fmt(delta)} over ${points.length} day${points.length === 1 ? '' : 's'}`
                : 'Daily follower count from IG /insights'
              : 'Engagement % across your most recent 12 posts (tap a point for details)'}
          </div>
        </div>
        {usingFollowers && projected30 != null && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-center">
            <div className="text-[9px] uppercase tracking-wide text-purple-700">30-day projection</div>
            <div className="text-sm font-bold text-purple-900">{fmt(projected30)}</div>
          </div>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-28 w-full"
        preserveAspectRatio="none"
        onMouseLeave={() => setActiveIdx(null)}
      >
        <defs>
          <linearGradient id="anl-grow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#anl-grow)" />
        <path
          d={line}
          fill="none"
          stroke="#7C3AED"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <g key={c.id}>
            <circle cx={c.x} cy={c.y} r="2.5" fill="#7C3AED" />
            <circle
              cx={c.x}
              cy={c.y}
              r="10"
              fill="transparent"
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => setActiveIdx(i)}
              style={{ cursor: 'pointer' }}
            />
          </g>
        ))}
        {active && (
          <g>
            <line
              x1={active.x}
              y1={0}
              x2={active.x}
              y2={H}
              stroke="#7C3AED"
              strokeWidth="1"
              strokeDasharray="2 2"
              opacity="0.5"
            />
            <circle cx={active.x} cy={active.y} r="4" fill="#7C3AED" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      {active && (
        <div className="mt-1 text-[11px] text-gray-700">
          <span className="font-semibold">{active.label}:</span>{' '}
          {usingFollowers ? `${fmt(active.value)} followers` : `${active.value.toFixed(2)}% engagement`}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Format breakdown
// ---------------------------------------------------------------------------

function FormatBreakdown({ perfs }: { perfs: ContentTypePerf[] }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Performance by content type
      </h2>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {perfs.map((c) => {
          const tone =
            c.avgEngagementPct > 5
              ? 'text-emerald-700'
              : c.avgEngagementPct >= 2
              ? 'text-amber-700'
              : 'text-rose-700';
          return (
            <div key={c.format} className="rounded-2xl border border-gray-200 bg-white p-3">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">
                {c.format} · n={c.count}
              </div>
              <div className="mt-0.5 text-lg font-semibold text-gray-900">
                {c.avgInteractions.toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-500">avg interactions</div>
              <div className={cn('mt-1 text-[11px] font-semibold', tone)}>
                {c.avgEngagementPct.toFixed(2)}% engagement
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sortable post list
// ---------------------------------------------------------------------------

function PostList({
  media,
  followers,
  sort,
  onSort,
}: {
  media: IgMedia[];
  followers: number | null;
  sort: SortKey;
  onSort: (s: SortKey) => void;
}) {
  const sorts: { id: SortKey; label: string }[] = [
    { id: 'recent', label: 'Most recent' },
    { id: 'likes', label: 'Most likes' },
    { id: 'comments', label: 'Most comments' },
    { id: 'engagement', label: 'Highest engagement' },
  ];
  // Baseline for "vs predicted" — if we had a Script with predictedEngagement
  // we'd thread that through, but lacking that for arbitrary posts we use the
  // creator's per-post average as the predicted baseline.
  const baseline = useMemo(() => {
    if (media.length === 0) return 0;
    return media.reduce((s, m) => s + m.likeCount + m.commentsCount, 0) / media.length;
  }, [media]);

  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Post performance
        </h2>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {sorts.map((s) => (
            <button
              key={s.id}
              onClick={() => onSort(s.id)}
              className={cn(
                'h-8 shrink-0 rounded-full border px-3 text-[11px] font-medium',
                sort === s.id
                  ? 'border-purple-600 bg-purple-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {media.map((p) => (
          <li key={p.id}>
            <PostRow post={p} followers={followers} baseline={baseline} />
          </li>
        ))}
        {media.length === 0 && (
          <li className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
            No posts yet — Instagram returned no recent media.
          </li>
        )}
      </ul>
    </section>
  );
}

function PostRow({
  post,
  followers,
  baseline,
}: {
  post: IgMedia;
  followers: number | null;
  baseline: number;
}) {
  const interactions = post.likeCount + post.commentsCount;
  const pct = engagementOf(post, followers);
  // "vs predicted" delta — clamped to ±150% so a single 10× outlier or a near-
  // zero baseline doesn't produce -98% / +12000% chips that read as broken.
  // The chip is a directional signal, not a precise stat; the precise number
  // is the engagement % already shown above.
  const rawDiffPct = baseline > 0
    ? Math.round(((interactions - baseline) / baseline) * 100)
    : 0;
  const diffPct = Math.max(-150, Math.min(150, rawDiffPct));
  const beat = rawDiffPct >= 0;
  // When clamped, prefix with "≥" / "≤" so it's obvious the real number is
  // beyond the band rather than exactly at the cap.
  const chipLabel = `${
    diffPct !== rawDiffPct ? (beat ? '>' : '<') : beat ? '+' : ''
  }${diffPct}% vs avg`;
  const remixPrompt = `Create a new post that builds on the angle from my piece titled "${(post.caption ?? '').slice(0, 80)}". Keep what worked, push it harder.`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 lg:flex-row lg:items-start">
      <div className="flex flex-1 items-start gap-3 lg:min-w-0">
        {(post.thumbnailUrl || post.mediaUrl) && (
          <img
            src={post.thumbnailUrl ?? post.mediaUrl ?? ''}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-semibold text-gray-900">
            {post.caption ?? '(no caption)'}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
            <span>{mediaTypeLabel(post.mediaType)}</span>
            <span>·</span>
            <span>{fmtAgo(post.timestamp)}</span>
            {pct != null && (
              <>
                <span>·</span>
                <span className={cn('rounded-full px-2 py-0.5 font-semibold', engagementTone(pct))}>
                  {pct.toFixed(2)}%
                </span>
              </>
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            <Metric icon={Heart} label="Likes" value={fmt(post.likeCount)} />
            <Metric icon={MessageSquare} label="Comments" value={fmt(post.commentsCount)} />
            <Metric icon={Eye} label="Total" value={fmt(interactions)} />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-2 lg:w-44">
        <span
          className={cn(
            'inline-flex items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            beat ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          )}
        >
          {beat ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {chipLabel}
        </span>
        <Link
          href={`/creator/content/scripts?prompt=${encodeURIComponent(remixPrompt)}`}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-purple-200 bg-white px-3 text-[11px] font-semibold text-purple-700 hover:border-purple-300"
        >
          <Sparkles className="h-3 w-3" /> Create similar
        </Link>
        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-gray-200 bg-white px-3 text-[11px] font-medium text-gray-700 hover:border-gray-300"
          >
            Open on IG <ArrowUpRight className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-1.5 py-1.5">
      <Icon className="mx-auto h-3 w-3 text-gray-400" />
      <div className="mt-0.5 text-[13px] font-semibold text-gray-900">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Format bar chart — engagement % per format, with trend arrow + winner flag
// ---------------------------------------------------------------------------

function FormatBarChart({
  breakdown,
  top,
}: {
  breakdown: Intelligence['contentBreakdown'];
  top: Intelligence['topPerformingType'];
}) {
  const entries: Array<[Intelligence['topPerformingType'], string, FormatStat]> = [
    ['reels', 'Reels', breakdown.reels],
    ['carousels', 'Carousels', breakdown.carousels],
    ['posts', 'Posts', breakdown.posts],
    ['stories', 'Stories', breakdown.stories],
  ];
  const visible = entries.filter(([, , s]) => s.count > 0);
  if (visible.length === 0) return null;
  const max = Math.max(...visible.map(([, , s]) => s.avgEngagement), 0.1);
  return (
    <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900">Format performance</div>
          <div className="text-[11px] text-gray-500">Engagement % per format · last 30 days</div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {visible.map(([key, label, s]) => {
          const isTop = key === top;
          const pct = (s.avgEngagement / max) * 100;
          const tone =
            s.avgEngagement > 5
              ? 'bg-emerald-500'
              : s.avgEngagement >= 2
              ? 'bg-amber-500'
              : 'bg-rose-500';
          return (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className={cn('font-semibold', isTop ? 'text-emerald-700' : 'text-gray-800')}>
                    {label}
                  </span>
                  <span className="text-gray-400">n={s.count}</span>
                  <TrendArrow trend={s.trend} />
                  {isTop && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                      TOP
                    </span>
                  )}
                </div>
                <span className="font-semibold tabular-nums text-gray-700">
                  {s.avgEngagement.toFixed(2)}%
                </span>
              </div>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn('h-full rounded-full transition-all', tone)}
                  style={{ width: `${Math.max(pct, 3)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-emerald-600" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-rose-600" />;
  return <span className="text-[10px] text-gray-400">—</span>;
}

// ---------------------------------------------------------------------------
// Best-times heatmap — 7 days × 4 quarter-day buckets. Highlights the slots
// the intelligence agent named, with a per-hour activity strip on top.
// ---------------------------------------------------------------------------

const HEAT_DAYS: Array<{ label: string; full: string }> = [
  { label: 'M', full: 'Monday' },
  { label: 'T', full: 'Tuesday' },
  { label: 'W', full: 'Wednesday' },
  { label: 'T', full: 'Thursday' },
  { label: 'F', full: 'Friday' },
  { label: 'S', full: 'Saturday' },
  { label: 'S', full: 'Sunday' },
];

const HEAT_BUCKETS = [
  { label: '6 AM', start: 6, end: 12 },
  { label: '12 PM', start: 12, end: 17 },
  { label: '5 PM', start: 17, end: 21 },
  { label: '9 PM', start: 21, end: 28 }, // 28 wraps to 4 AM next day
];

function HeatmapCard({
  best,
  worst,
  active,
}: {
  best: PostingSlot[];
  worst: PostingSlot[];
  active: Array<{ hour: number; engagement: 'high' | 'medium' | 'low' }>;
}) {
  const parseHour = (time: string): number => {
    const m = time.match(/(\d+):\d+\s*(AM|PM)/i);
    if (!m) return -1;
    let h = parseInt(m[1], 10) % 12;
    if (m[2].toUpperCase() === 'PM') h += 12;
    return h;
  };
  const slotKey = (day: string, hour: number): string => {
    const dayIdx = HEAT_DAYS.findIndex((d) => d.full === day);
    if (dayIdx === -1) return '';
    const bucketIdx = HEAT_BUCKETS.findIndex(
      (b) => hour >= b.start && hour < b.end
    );
    if (bucketIdx === -1) return '';
    return `${dayIdx}:${bucketIdx}`;
  };
  const bestKeys = new Set(best.map((s) => slotKey(s.day, parseHour(s.time))));
  const worstKeys = new Set(worst.map((s) => slotKey(s.day, parseHour(s.time))));

  return (
    <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-gray-900">Best times to post</div>
        <div className="text-[11px] text-gray-500">
          7 days × 4 windows. Green = high engagement, red = avoid. Based on your posting history.
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-[44px_repeat(7,minmax(28px,1fr))] gap-1 text-center">
          <div />
          {HEAT_DAYS.map((d, i) => (
            <div key={i} className="text-[10px] font-semibold uppercase text-gray-500">
              {d.label}
            </div>
          ))}
          {HEAT_BUCKETS.map((b, bIdx) => (
            <Fragment key={bIdx}>
              <div className="self-center text-[10px] text-gray-500">{b.label}</div>
              {HEAT_DAYS.map((_, dIdx) => {
                const key = `${dIdx}:${bIdx}`;
                const isBest = bestKeys.has(key);
                const isWorst = worstKeys.has(key);
                const cls = isBest
                  ? 'bg-emerald-500'
                  : isWorst
                  ? 'bg-rose-400'
                  : 'bg-gray-100';
                return (
                  <div
                    key={`c-${dIdx}-${bIdx}`}
                    className={cn(
                      'h-7 w-full rounded-md transition-transform hover:scale-110',
                      cls
                    )}
                    title={
                      isBest
                        ? `Best slot — ${HEAT_DAYS[dIdx].full} ${b.label}`
                        : isWorst
                        ? `Avoid — ${HEAT_DAYS[dIdx].full} ${b.label}`
                        : ''
                    }
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Audience active-hours strip — single row, 24 cells. Helps spot why
          a slot wins (it lines up with audience activity). */}
      {active.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Audience activity by hour
          </div>
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}
          >
            {Array.from({ length: 24 }, (_, h) => {
              const a = active.find((x) => x.hour === h);
              const tone =
                a?.engagement === 'high'
                  ? 'bg-emerald-500'
                  : a?.engagement === 'medium'
                  ? 'bg-amber-400'
                  : a
                  ? 'bg-gray-300'
                  : 'bg-gray-100';
              return (
                <div
                  key={h}
                  className={cn('h-4 rounded-sm', tone)}
                  title={`${h}:00${a ? ` — ${a.engagement}` : ''}`}
                />
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-gray-400">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>11 PM</span>
          </div>
        </div>
      )}

      {best.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {best.map((s, i) => (
            <span
              key={i}
              className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
            >
              {s.day} {s.time} · {s.avgEngagement.toFixed(1)}%
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Hashtag cloud — size scales with avgReach; red ring = overused; purple
// chips below = agent-recommended new tags to test.
// ---------------------------------------------------------------------------

function HashtagCloud({
  stats,
  recommended,
  overused,
}: {
  stats: HashtagStat[];
  recommended: string[];
  overused: string[];
}) {
  if (stats.length === 0) return null;
  const max = Math.max(...stats.map((s) => s.avgReach), 1);
  const min = Math.min(...stats.map((s) => s.avgReach), 0);
  const range = Math.max(max - min, 1);
  const overusedSet = new Set(overused.map((t) => t.toLowerCase()));
  return (
    <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <Hash className="h-3.5 w-3.5 text-purple-600" /> Hashtag effectiveness
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {stats.map((s) => {
          const intensity = (s.avgReach - min) / range;
          const size = 11 + intensity * 7; // 11 → 18 px
          const isOverused = overusedSet.has(s.hashtag.toLowerCase());
          return (
            <span
              key={s.hashtag}
              title={`${s.hashtag} · ${s.avgReach.toLocaleString()} avg interactions · used ${s.frequency}×`}
              className={cn(
                'inline-flex items-baseline gap-1 rounded-full px-2.5 py-1 font-semibold transition-colors',
                isOverused
                  ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-300'
                  : intensity > 0.66
                  ? 'bg-emerald-100 text-emerald-800'
                  : intensity > 0.33
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-700'
              )}
              style={{ fontSize: `${size}px` }}
            >
              {s.hashtag}
              <span className="text-[10px] font-medium opacity-70">
                {s.avgReach >= 1000
                  ? `${(s.avgReach / 1000).toFixed(1)}k`
                  : s.avgReach}
              </span>
            </span>
          );
        })}
      </div>
      {recommended.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-700">
            Try these next
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recommended.map((t) => (
              <span
                key={t}
                className="rounded-full border border-purple-200 bg-white px-2.5 py-1 text-[11px] font-medium text-purple-700"
              >
                {t.startsWith('#') ? t : `#${t}`}
              </span>
            ))}
          </div>
        </div>
      )}
      {overused.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50/50 p-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
          <div className="text-[11px] text-rose-800">
            <span className="font-semibold">Burning a slot:</span> {overused.join(', ')} — used often but pull below-median reach.
          </div>
        </div>
      )}
    </section>
  );
}
