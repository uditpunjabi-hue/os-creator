import 'server-only';
import { getInstagramProfile } from './instagram';
import { getInstagramInsights } from './instagram-insights';
import { callClaude } from './anthropic';
import { memoryCache } from './memory-cache';

export interface HashtagStat {
  tag: string;
  uses: number;
  avgInteractions: number;
}

export interface WeeklyReport {
  connected: boolean;
  generatedAt: string | null;
  periodLabel: string; // e.g. "May 7 – May 13, 2026"
  postsLast7Days: number;
  recapHeadline: string;
  whatWorked: string[];
  whatDidnt: string[];
  recommendations: string[];
  bestTimeToPost: string;
  formatBreakdown: Array<{ format: string; count: number; avgInteractions: number; verdict: string }>;
  topHashtags: HashtagStat[];
}

const CACHE_KEY = (orgId: string) => `ig:weekly-report:${orgId}`;
const CACHE_TTL = 24 * 60 * 60;
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
const inFlight = new Map<string, Promise<WeeklyReport>>();

const SYSTEM_PROMPT = `You are a senior content strategist briefing a solo creator on their last week.
Given their last 7 days of posts (captions, likes, comments, post type, timestamp), produce a
specific, data-grounded recap. NO platitudes. Cite numbers, formats, and caption fragments.

Return STRICT JSON in this shape, no prose or markdown fences:
{
  "recapHeadline": "one-line summary of the week — e.g. 'Reels carried the week, carousels stalled.'",
  "whatWorked": ["3-5 specific wins, < 22 words each, citing numbers"],
  "whatDidnt": ["1-3 specific misses, < 22 words each"],
  "recommendations": ["3-5 actions for next week, concrete and ranked by leverage"]
}

If there isn't enough data (fewer than 2 posts), say so honestly in recapHeadline and keep the
arrays short — never invent numbers.`;

export async function getWeeklyReport(orgId: string, force = false): Promise<WeeklyReport> {
  if (!force) {
    const cached = memoryCache.get<WeeklyReport>(CACHE_KEY(orgId));
    if (cached) {
      const age = cached.generatedAt ? Date.now() - Date.parse(cached.generatedAt) : 0;
      if (age > STALE_AFTER_MS) triggerBackgroundRefresh(orgId);
      return cached;
    }
  }
  return regenerate(orgId);
}

function triggerBackgroundRefresh(orgId: string) {
  if (inFlight.has(orgId)) return;
  const p = regenerate(orgId).catch((e) => {
    console.warn(`Weekly report background refresh failed: ${(e as Error).message}`);
    return (
      memoryCache.get<WeeklyReport>(CACHE_KEY(orgId)) ?? emptyReport(false)
    );
  });
  inFlight.set(orgId, p);
  void p.finally(() => inFlight.delete(orgId));
}

async function regenerate(orgId: string): Promise<WeeklyReport> {
  const existing = inFlight.get(orgId);
  if (existing) return existing;

  const work = (async (): Promise<WeeklyReport> => {
    const [profile, insights] = await Promise.all([
      getInstagramProfile(orgId),
      getInstagramInsights(orgId),
    ]);
    if (!profile.connected) return emptyReport(false);

    // Last 7 days. We don't fetch a fresh window — the recent media list IS
    // the source of truth and is already cached + filtered.
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const last7 = profile.recentMedia.filter(
      (m) => now - Date.parse(m.timestamp) <= SEVEN_DAYS
    );
    const followers = profile.followers ?? 0;

    // Format breakdown specific to the week's window (server-side insights is
    // computed on ALL recentMedia; that's still useful as a baseline).
    const formatBreakdown = buildFormatBreakdown(last7, insights.contentTypePerformance);
    const topHashtags = computeHashtagStats(last7);
    const bestTimeToPost = insights.bestTimes[0]
      ? formatBestTime(insights.bestTimes[0])
      : 'Not enough data yet — post 3+ at varied times and we’ll surface a winner.';

    const periodStart = new Date(now - SEVEN_DAYS);
    const periodLabel = formatPeriod(periodStart, new Date(now));

    // Even with zero posts in the last 7 days we still return a valid (empty-ish)
    // shape — the UI shouldn't break.
    let llm: {
      recapHeadline: string;
      whatWorked: string[];
      whatDidnt: string[];
      recommendations: string[];
    };
    if (last7.length === 0) {
      llm = {
        recapHeadline: 'No posts in the last 7 days — nothing to recap yet.',
        whatWorked: [],
        whatDidnt: [],
        recommendations: [
          'Post at least 2 reels this week to give the algorithm a signal.',
          'Pull a hook idea from your top-performing post and repurpose it.',
        ],
      };
    } else {
      try {
        const payload = {
          handle: profile.handle,
          followers,
          bio: profile.bio,
          weekPosts: last7.map((m) => ({
            type: m.mediaType,
            caption: (m.caption ?? '').slice(0, 280),
            likes: m.likeCount,
            comments: m.commentsCount,
            timestamp: m.timestamp,
          })),
          formatBreakdown,
          bestTimes: insights.bestTimes.slice(0, 3),
          baselineAvg: averageInteractions(profile.recentMedia),
        };
        llm = await callClaude({
          systemPrompt: SYSTEM_PROMPT,
          userMessage: `Recap this creator's last 7 days:\n\n${JSON.stringify(payload, null, 2)}`,
          maxTokens: 1400,
        });
      } catch (e) {
        console.warn(`Weekly report Claude call failed: ${(e as Error).message}`);
        llm = {
          recapHeadline: `Posted ${last7.length} time${last7.length === 1 ? '' : 's'} in the last 7 days.`,
          whatWorked: [],
          whatDidnt: [],
          recommendations: ['AI recap unavailable right now — try refreshing in a few minutes.'],
        };
      }
    }

    const out: WeeklyReport = {
      connected: true,
      generatedAt: new Date().toISOString(),
      periodLabel,
      postsLast7Days: last7.length,
      recapHeadline: llm.recapHeadline ?? '',
      whatWorked: llm.whatWorked ?? [],
      whatDidnt: llm.whatDidnt ?? [],
      recommendations: llm.recommendations ?? [],
      bestTimeToPost,
      formatBreakdown,
      topHashtags,
    };
    memoryCache.set(CACHE_KEY(orgId), out, CACHE_TTL);
    return out;
  })();

  inFlight.set(orgId, work);
  try {
    return await work;
  } finally {
    inFlight.delete(orgId);
  }
}

function emptyReport(connected: boolean): WeeklyReport {
  return {
    connected,
    generatedAt: null,
    periodLabel: '',
    postsLast7Days: 0,
    recapHeadline: '',
    whatWorked: [],
    whatDidnt: [],
    recommendations: [],
    bestTimeToPost: '',
    formatBreakdown: [],
    topHashtags: [],
  };
}

function buildFormatBreakdown(
  weekMedia: { mediaType: string; likeCount: number; commentsCount: number }[],
  baseline: Array<{ format: string; avgInteractions: number }>
) {
  const buckets: Record<string, { count: number; interactions: number }> = {};
  for (const m of weekMedia) {
    const fmt =
      m.mediaType === 'VIDEO'
        ? 'Reel'
        : m.mediaType === 'CAROUSEL_ALBUM'
        ? 'Carousel'
        : m.mediaType === 'STORY'
        ? 'Story'
        : 'Image';
    const b = buckets[fmt] ?? { count: 0, interactions: 0 };
    b.count += 1;
    b.interactions += m.likeCount + m.commentsCount;
    buckets[fmt] = b;
  }
  return Object.entries(buckets).map(([format, b]) => {
    const avg = b.count > 0 ? Math.round(b.interactions / b.count) : 0;
    const baseEntry = baseline.find((x) => x.format === format);
    const baseAvg = baseEntry?.avgInteractions ?? 0;
    let verdict = 'in line with average';
    if (baseAvg > 0) {
      const diff = (avg - baseAvg) / baseAvg;
      if (diff > 0.2) verdict = `${Math.round(diff * 100)}% above your avg`;
      else if (diff < -0.2) verdict = `${Math.round(diff * 100)}% below your avg`;
    }
    return { format, count: b.count, avgInteractions: avg, verdict };
  });
}

function computeHashtagStats(
  media: { caption: string | null; likeCount: number; commentsCount: number }[]
): HashtagStat[] {
  const map = new Map<string, { uses: number; interactions: number }>();
  for (const m of media) {
    const tags = m.caption?.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    const unique = new Set(tags.map((t) => t.toLowerCase()));
    for (const tag of unique) {
      const entry = map.get(tag) ?? { uses: 0, interactions: 0 };
      entry.uses += 1;
      entry.interactions += m.likeCount + m.commentsCount;
      map.set(tag, entry);
    }
  }
  return Array.from(map.entries())
    .map(([tag, e]) => ({
      tag,
      uses: e.uses,
      avgInteractions: e.uses > 0 ? Math.round(e.interactions / e.uses) : 0,
    }))
    .sort((a, b) => b.avgInteractions - a.avgInteractions)
    .slice(0, 6);
}

function averageInteractions(
  media: { likeCount: number; commentsCount: number }[]
): number {
  if (media.length === 0) return 0;
  const sum = media.reduce((s, m) => s + m.likeCount + m.commentsCount, 0);
  return Math.round(sum / media.length);
}

function formatBestTime(t: { weekday: string; hour: number }): string {
  const hour12 = t.hour % 12 || 12;
  const meridiem = t.hour >= 12 ? 'PM' : 'AM';
  return `${t.weekday} ${hour12}:00 ${meridiem}`;
}

function formatPeriod(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString([], opts)} – ${end.toLocaleDateString([], { ...opts, year: 'numeric' })}`;
}
