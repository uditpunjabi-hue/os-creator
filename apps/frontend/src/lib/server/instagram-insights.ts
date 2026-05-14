import 'server-only';
import { prisma } from './prisma';
import { getInstagramProfile, type IgMedia } from './instagram';

const FB_GRAPH = 'https://graph.facebook.com/v18.0';

export interface ContentTypePerf {
  format: 'Reel' | 'Carousel' | 'Image' | 'Story';
  count: number;
  avgInteractions: number;
  avgEngagementPct: number;
}

export interface BestTime {
  weekday: string;
  hour: number;
  avgInteractions: number;
  posts: number;
}

export interface FollowerTrendPoint {
  date: string;
  count: number;
}

export interface RealInsight {
  kind: 'good' | 'warn';
  title: string;
  detail: string;
}

export interface InsightsResponse {
  connected: boolean;
  engagementRate: number | null;
  contentTypePerformance: ContentTypePerf[];
  bestTimes: BestTime[];
  followerTrend: FollowerTrendPoint[];
  insights: RealInsight[];
}

export async function getInstagramInsights(
  orgId: string,
  tzOffsetMin = 330
): Promise<InsightsResponse> {
  const profile = await getInstagramProfile(orgId);
  if (!profile.connected) {
    return {
      connected: false,
      engagementRate: null,
      contentTypePerformance: [],
      bestTimes: [],
      followerTrend: [],
      insights: [],
    };
  }

  const followers = profile.followers ?? 0;
  const media = profile.recentMedia;
  const contentTypePerformance = computeContentTypePerf(media, followers);
  const bestTimes = computeBestTimes(media, tzOffsetMin);
  const followerTrend = await fetchFollowerTrend(orgId);
  const insights = synthesizeInsights(contentTypePerformance, bestTimes, media, followers);

  return {
    connected: true,
    engagementRate: profile.engagementRate,
    contentTypePerformance,
    bestTimes,
    followerTrend,
    insights,
  };
}

function computeContentTypePerf(media: IgMedia[], followers: number): ContentTypePerf[] {
  const buckets: Record<ContentTypePerf['format'], { interactions: number; count: number }> = {
    Reel: { interactions: 0, count: 0 },
    Carousel: { interactions: 0, count: 0 },
    Image: { interactions: 0, count: 0 },
    Story: { interactions: 0, count: 0 },
  };
  for (const m of media) {
    const fmt: ContentTypePerf['format'] =
      m.mediaType === 'VIDEO'
        ? 'Reel'
        : m.mediaType === 'CAROUSEL_ALBUM'
        ? 'Carousel'
        : m.mediaType === 'STORY'
        ? 'Story'
        : 'Image';
    buckets[fmt].interactions += m.likeCount + m.commentsCount;
    buckets[fmt].count += 1;
  }
  return (Object.keys(buckets) as ContentTypePerf['format'][])
    .filter((f) => buckets[f].count > 0)
    .map((f) => ({
      format: f,
      count: buckets[f].count,
      avgInteractions: Math.round(buckets[f].interactions / buckets[f].count),
      avgEngagementPct:
        followers > 0
          ? Math.round((buckets[f].interactions / buckets[f].count / followers) * 100 * 100) / 100
          : 0,
    }))
    .sort((a, b) => b.avgInteractions - a.avgInteractions);
}

function computeBestTimes(media: IgMedia[], tzOffsetMin: number): BestTime[] {
  if (media.length === 0) return [];
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const buckets = new Map<
    string,
    { interactions: number; count: number; weekday: string; hour: number }
  >();
  for (const m of media) {
    const utc = new Date(m.timestamp);
    const local = new Date(utc.getTime() + tzOffsetMin * 60 * 1000);
    const weekday = weekdays[local.getUTCDay()];
    const hour = local.getUTCHours();
    const key = `${weekday}-${hour}`;
    const entry = buckets.get(key) ?? { interactions: 0, count: 0, weekday, hour };
    entry.interactions += m.likeCount + m.commentsCount;
    entry.count += 1;
    buckets.set(key, entry);
  }
  return Array.from(buckets.values())
    .map((b) => ({
      weekday: b.weekday,
      hour: b.hour,
      avgInteractions: Math.round(b.interactions / b.count),
      posts: b.count,
    }))
    .sort((a, b) => b.avgInteractions - a.avgInteractions)
    .slice(0, 4);
}

async function fetchFollowerTrend(orgId: string): Promise<FollowerTrendPoint[]> {
  const user = await prisma.user.findFirst({
    where: {
      instagramConnectedAt: { not: null },
      organizations: { some: { organizationId: orgId, disabled: false } },
    },
    select: { instagramAccessToken: true, instagramUserId: true },
  });
  if (!user?.instagramAccessToken || !user.instagramUserId) return [];

  try {
    const url = `${FB_GRAPH}/${user.instagramUserId}/insights?metric=follower_count&period=day&access_token=${encodeURIComponent(user.instagramAccessToken)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: Array<{ name: string; values?: Array<{ value: number; end_time: string }> }>;
    };
    return (data.data?.[0]?.values ?? []).map((v) => ({
      date: v.end_time.slice(0, 10),
      count: v.value,
    }));
  } catch (e) {
    console.warn(`IG follower trend crashed: ${(e as Error).message}`);
    return [];
  }
}

function synthesizeInsights(
  perf: ContentTypePerf[],
  bestTimes: BestTime[],
  media: IgMedia[],
  followers: number
): RealInsight[] {
  const out: RealInsight[] = [];

  if (perf.length >= 2) {
    const top = perf[0];
    const next = perf[1];
    const ratio = next.avgInteractions > 0
      ? (top.avgInteractions / next.avgInteractions).toFixed(1)
      : null;
    if (ratio && parseFloat(ratio) >= 1.2) {
      out.push({
        kind: 'good',
        title: `${top.format}s outperform ${next.format.toLowerCase()}s ${ratio}x`,
        detail: `Avg ${top.avgInteractions.toLocaleString()} interactions on ${top.format}s vs ${next.avgInteractions.toLocaleString()} on ${next.format.toLowerCase()}s across your last ${media.length} posts. Lean into the format that's earning.`,
      });
    }
  }

  if (bestTimes.length > 0) {
    const t = bestTimes[0];
    const meridiem = t.hour >= 12 ? 'PM' : 'AM';
    const hour12 = t.hour % 12 || 12;
    out.push({
      kind: 'good',
      title: `Your best slot is ${t.weekday} ${hour12}:00 ${meridiem}`,
      detail: `Posts at that slot average ${t.avgInteractions.toLocaleString()} interactions (n=${t.posts}).`,
    });
  }

  if (perf.length >= 2 && followers > 0) {
    const laggard = perf[perf.length - 1];
    if (laggard.avgEngagementPct < (perf[0].avgEngagementPct ?? 0) * 0.6) {
      out.push({
        kind: 'warn',
        title: `${laggard.format} engagement is lagging at ${laggard.avgEngagementPct}%`,
        detail: `Your ${laggard.format.toLowerCase()}s convert at less than 60% of your best format's rate.`,
      });
    }
  }

  if (out.length === 0) {
    out.push({
      kind: 'warn',
      title: 'Not enough recent posts to compute insights',
      detail: "IG returned fewer than expected media items. Post more and we'll surface real signals.",
    });
  }

  return out;
}
