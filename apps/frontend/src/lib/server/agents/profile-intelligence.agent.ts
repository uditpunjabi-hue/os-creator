import 'server-only';
import { prisma } from '../prisma';
import { getInstagramProfile, type IgMedia } from '../instagram';
import { getInstagramInsights } from '../instagram-insights';
import { callClaude } from '../anthropic';
import { memoryCache } from '../memory-cache';

// ---------------------------------------------------------------------------
// Public shape — every UI page consumes this. Compute-vs-narrative split:
//   * Numbers come from deterministic aggregations over the IG media list.
//   * Sentences come from Claude with the data as input.
// Keeping them separate stops the LLM from "inventing" stats.
// ---------------------------------------------------------------------------

export type Trend = 'up' | 'down' | 'stable';
export type GrowthTrend = 'accelerating' | 'steady' | 'declining' | 'unknown';
export type EngagementTrend = 'improving' | 'stable' | 'declining';

export interface PostingSlot {
  day: string;
  time: string;
  avgEngagement: number; // engagement % at this slot
}

export interface FormatStat {
  count: number;
  avgEngagement: number;
  trend: Trend;
}

export interface HashtagStat {
  hashtag: string;
  avgReach: number; // proxy = avg interactions on posts that used this tag
  frequency: number;
}

export interface CompetitorInsightBlock {
  youPostMore: boolean;
  theyGetMoreEngagement: boolean;
  keyDifference: string;
  stealableStrategy: string;
}

export interface ScoreBreakdown {
  contentQuality: number;
  postingConsistency: number;
  engagementRate: number;
  hashtagStrategy: number;
  audienceGrowth: number;
}

export interface PlanDay {
  day: string;
  action: string;
  reason: string;
}

export interface ProfileIntelligence {
  connected: boolean;
  generatedAt: string | null;
  windowDays: number;

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
  contentPreferences: string;

  growthRate: string;
  growthTrend: GrowthTrend;
  projectedFollowers30Days: number | null;

  avgEngagementRate: number;
  engagementTrend: EngagementTrend;
  topEngagementDrivers: string[];
  engagementKillers: string[];

  avgCaptionLength: number;
  bestCaptionStyle: string;
  emojiUsage: string;

  thisWeekPlan: PlanDay[];

  competitorInsights: CompetitorInsightBlock | null;

  profileHealthScore: number;
  scoreBreakdown: ScoreBreakdown;

  // True when the Claude narrative call failed; deterministic stats are still
  // valid (scores, breakdowns, times). UI uses this to show a "narrative
  // regenerating" pill instead of fields that look intentionally empty.
  partial?: boolean;
}

// ---------------------------------------------------------------------------
// Cache — 6h hard, stale-while-revalidate beyond. Matches the SWR pattern
// used by ai-insights and weekly-report.
// ---------------------------------------------------------------------------

const CACHE_KEY = (orgId: string) => `creator:intelligence:${orgId}`;
const CACHE_TTL = 24 * 60 * 60;
// When Claude times out, only the narrative half is missing; the
// deterministic stats are real. Cache short so we retry quickly without
// hammering the API every page load.
const PARTIAL_CACHE_TTL = 5 * 60;
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
const inFlight = new Map<string, Promise<ProfileIntelligence>>();

export async function getProfileIntelligence(
  orgId: string,
  force = false
): Promise<ProfileIntelligence> {
  if (!force) {
    const cached = memoryCache.get<ProfileIntelligence>(CACHE_KEY(orgId));
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
    console.warn(`Intelligence background refresh failed: ${(e as Error).message}`);
    return memoryCache.get<ProfileIntelligence>(CACHE_KEY(orgId)) ?? empty(false);
  });
  inFlight.set(orgId, p);
  void p.finally(() => inFlight.delete(orgId));
}

async function regenerate(orgId: string): Promise<ProfileIntelligence> {
  const existing = inFlight.get(orgId);
  if (existing) return existing;
  const work = doAnalysis(orgId);
  inFlight.set(orgId, work);
  try {
    const result = await work;
    memoryCache.set(
      CACHE_KEY(orgId),
      result,
      result.partial ? PARTIAL_CACHE_TTL : CACHE_TTL
    );
    return result;
  } finally {
    inFlight.delete(orgId);
  }
}

// ---------------------------------------------------------------------------
// Main analysis pipeline
// ---------------------------------------------------------------------------

async function doAnalysis(orgId: string): Promise<ProfileIntelligence> {
  const [profile, insights, competitors] = await Promise.all([
    getInstagramProfile(orgId),
    getInstagramInsights(orgId),
    prisma.competitor.findMany({ where: { organizationId: orgId }, take: 8 }),
  ]);

  if (!profile.connected) return empty(false);

  const followers = profile.followers ?? 0;
  const media = profile.recentMedia;
  // Window the media to the last 30 days for "recent" stats, but keep all of
  // it for hashtag analysis (more samples → better signal).
  const recent30 = media.filter(
    (m) => Date.now() - Date.parse(m.timestamp) <= 30 * 24 * 60 * 60 * 1000
  );
  const windowDays = 30;

  // -- Deterministic stats --------------------------------------------------
  const bestPostingTimes = pickSlots(insights.bestTimes, followers, 3, 'top');
  const worstPostingTimes = pickSlots(insights.bestTimes, followers, 3, 'bottom');
  const optimalFrequency = computeOptimalFrequency(recent30);
  const contentBreakdown = computeContentBreakdown(media, recent30, followers);
  const topPerformingType = pickTopFormat(contentBreakdown);
  const hashtagEffectiveness = computeHashtagEffectiveness(media);
  const overusedHashtags = computeOverused(hashtagEffectiveness);
  const audienceActiveHours = computeActiveHours(insights.bestTimes);
  const avgCaptionLength = computeAvgCaptionLength(recent30);
  const avgEngagementRate = profile.engagementRate ?? 0;
  const engagementTrend = computeEngagementTrend(media);
  const { growthRate, growthTrend, projectedFollowers30Days } = computeGrowth(
    insights.followerTrend,
    followers
  );

  // -- Score breakdown ------------------------------------------------------
  // Each subscore is 0-100. Whole formula is intentionally simple — clarity
  // beats false-precision here, the score is meant as a directional gauge.
  const scoreBreakdown: ScoreBreakdown = {
    contentQuality: scoreContentQuality(recent30, followers),
    postingConsistency: scorePostingConsistency(recent30),
    engagementRate: scoreEngagementRate(avgEngagementRate),
    hashtagStrategy: scoreHashtagStrategy(hashtagEffectiveness, overusedHashtags),
    audienceGrowth: scoreAudienceGrowth(growthTrend, insights.followerTrend),
  };
  const profileHealthScore = Math.round(
    (scoreBreakdown.contentQuality +
      scoreBreakdown.postingConsistency +
      scoreBreakdown.engagementRate +
      scoreBreakdown.hashtagStrategy +
      scoreBreakdown.audienceGrowth) /
      5
  );

  // -- Narrative from Claude ------------------------------------------------
  const { narrative, partial } = await runNarrativeAnalysis({
    handle: profile.handle ?? null,
    followers,
    bio: profile.bio,
    recent30: recent30.map((m) => ({
      type: mediaTypeLabel(m.mediaType),
      caption: (m.caption ?? '').slice(0, 280),
      likes: m.likeCount,
      comments: m.commentsCount,
      timestamp: m.timestamp,
    })),
    contentBreakdown,
    topFormat: topPerformingType,
    hashtagEffectiveness: hashtagEffectiveness.slice(0, 10),
    bestPostingTimes,
    worstPostingTimes,
    avgEngagementRate,
    engagementTrend,
    growthTrend,
    competitors: competitors.map((c) => ({
      handle: c.handle,
      followers: c.followers,
      engagement: c.engagement,
      growth30d: c.growth30d,
      notes: c.notes,
    })),
  });

  return {
    connected: true,
    generatedAt: new Date().toISOString(),
    windowDays,
    bestPostingTimes,
    worstPostingTimes,
    optimalFrequency,
    contentBreakdown,
    topPerformingType,
    hashtagEffectiveness: hashtagEffectiveness.slice(0, 10),
    recommendedHashtags: narrative.recommendedHashtags ?? [],
    overusedHashtags,
    audienceActiveHours,
    contentPreferences: narrative.contentPreferences ?? '',
    growthRate,
    growthTrend,
    projectedFollowers30Days,
    avgEngagementRate,
    engagementTrend,
    topEngagementDrivers: narrative.topEngagementDrivers ?? [],
    engagementKillers: narrative.engagementKillers ?? [],
    avgCaptionLength,
    bestCaptionStyle: narrative.bestCaptionStyle ?? '',
    emojiUsage: narrative.emojiUsage ?? '',
    thisWeekPlan: narrative.thisWeekPlan ?? [],
    competitorInsights: competitors.length > 0 ? narrative.competitorInsights ?? null : null,
    profileHealthScore,
    scoreBreakdown,
    partial,
  };
}

// ---------------------------------------------------------------------------
// Deterministic computations
// ---------------------------------------------------------------------------

function mediaTypeLabel(t: string): 'Reel' | 'Carousel' | 'Image' | 'Story' {
  if (t === 'VIDEO') return 'Reel';
  if (t === 'CAROUSEL_ALBUM') return 'Carousel';
  if (t === 'STORY') return 'Story';
  return 'Image';
}

function pickSlots(
  times: { weekday: string; hour: number; avgInteractions: number; posts: number }[],
  followers: number,
  count: number,
  end: 'top' | 'bottom'
): PostingSlot[] {
  if (times.length === 0 || followers <= 0) return [];
  const dayNames: Record<string, string> = {
    Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
    Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday',
  };
  const sorted = [...times].sort((a, b) =>
    end === 'top' ? b.avgInteractions - a.avgInteractions : a.avgInteractions - b.avgInteractions
  );
  return sorted.slice(0, count).map((t) => ({
    day: dayNames[t.weekday] ?? t.weekday,
    time: formatHour(t.hour),
    avgEngagement: round2((t.avgInteractions / followers) * 100),
  }));
}

function formatHour(h: number): string {
  const hour12 = h % 12 || 12;
  const meridiem = h >= 12 ? 'PM' : 'AM';
  return `${hour12}:00 ${meridiem}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeOptimalFrequency(recent30: IgMedia[]): string {
  if (recent30.length === 0) return 'Post 3-5x/week to establish a rhythm';
  const perWeek = (recent30.length / 30) * 7;
  if (perWeek >= 5) return `${perWeek.toFixed(1)} posts/week — keep this cadence`;
  if (perWeek >= 3) return `${perWeek.toFixed(1)} posts/week — consider bumping to 5+`;
  return `Currently ${perWeek.toFixed(1)} posts/week — aim for 4-5 for momentum`;
}

function computeContentBreakdown(
  all: IgMedia[],
  recent30: IgMedia[],
  followers: number
): ProfileIntelligence['contentBreakdown'] {
  // Trend = compare last 15 days vs prior 15 days for each format.
  const cutoff = Date.now() - 15 * 24 * 60 * 60 * 1000;
  const last15 = recent30.filter((m) => Date.parse(m.timestamp) >= cutoff);
  const prior15 = recent30.filter((m) => Date.parse(m.timestamp) < cutoff);

  const compute = (
    label: 'Reel' | 'Carousel' | 'Image' | 'Story'
  ): FormatStat => {
    const matches = recent30.filter((m) => mediaTypeLabel(m.mediaType) === label);
    if (matches.length === 0) return { count: 0, avgEngagement: 0, trend: 'stable' };
    const avgInter =
      matches.reduce((s, m) => s + m.likeCount + m.commentsCount, 0) / matches.length;
    const avgEng = followers > 0 ? round2((avgInter / followers) * 100) : 0;

    const last15Match = last15.filter((m) => mediaTypeLabel(m.mediaType) === label);
    const prior15Match = prior15.filter((m) => mediaTypeLabel(m.mediaType) === label);
    let trend: Trend = 'stable';
    if (last15Match.length > 0 && prior15Match.length > 0) {
      const a = avgInteractions(last15Match);
      const b = avgInteractions(prior15Match);
      const diff = (a - b) / Math.max(b, 1);
      if (diff > 0.15) trend = 'up';
      else if (diff < -0.15) trend = 'down';
    }
    return { count: matches.length, avgEngagement: avgEng, trend };
  };

  return {
    reels: compute('Reel'),
    posts: compute('Image'),
    carousels: compute('Carousel'),
    stories: compute('Story'),
  };
}

function avgInteractions(media: IgMedia[]): number {
  if (media.length === 0) return 0;
  return media.reduce((s, m) => s + m.likeCount + m.commentsCount, 0) / media.length;
}

function pickTopFormat(b: ProfileIntelligence['contentBreakdown']): ProfileIntelligence['topPerformingType'] {
  const entries: Array<[ProfileIntelligence['topPerformingType'], FormatStat]> = [
    ['reels', b.reels],
    ['posts', b.posts],
    ['carousels', b.carousels],
    ['stories', b.stories],
  ];
  const eligible = entries.filter(([, s]) => s.count > 0);
  if (eligible.length === 0) return null;
  eligible.sort((a, b2) => b2[1].avgEngagement - a[1].avgEngagement);
  return eligible[0][0];
}

function computeHashtagEffectiveness(media: IgMedia[]): HashtagStat[] {
  const map = new Map<string, { uses: number; interactions: number }>();
  for (const m of media) {
    const tags = m.caption?.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    const unique = new Set(tags.map((t) => t.toLowerCase()));
    for (const tag of unique) {
      const e = map.get(tag) ?? { uses: 0, interactions: 0 };
      e.uses += 1;
      e.interactions += m.likeCount + m.commentsCount;
      map.set(tag, e);
    }
  }
  return Array.from(map.entries())
    .filter(([, e]) => e.uses >= 1)
    .map(([hashtag, e]) => ({
      hashtag,
      avgReach: Math.round(e.interactions / e.uses),
      frequency: e.uses,
    }))
    .sort((a, b) => b.avgReach - a.avgReach);
}

function computeOverused(stats: HashtagStat[]): string[] {
  // Frequent + below-median reach = burning a slot. Bottom half of avgReach
  // with frequency ≥ 3.
  if (stats.length < 4) return [];
  const sortedByReach = [...stats].sort((a, b) => a.avgReach - b.avgReach);
  const medianIdx = Math.floor(sortedByReach.length / 2);
  const medianReach = sortedByReach[medianIdx].avgReach;
  return stats
    .filter((s) => s.frequency >= 3 && s.avgReach < medianReach)
    .slice(0, 5)
    .map((s) => s.hashtag);
}

function computeActiveHours(
  times: { weekday: string; hour: number; avgInteractions: number; posts: number }[]
): Array<{ hour: number; engagement: 'high' | 'medium' | 'low' }> {
  if (times.length === 0) return [];
  // Collapse by hour-of-day, average across weekdays.
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const t of times) {
    const e = buckets.get(t.hour) ?? { sum: 0, n: 0 };
    e.sum += t.avgInteractions;
    e.n += 1;
    buckets.set(t.hour, e);
  }
  const list = Array.from(buckets.entries()).map(([hour, e]) => ({
    hour,
    avg: e.sum / e.n,
  }));
  if (list.length === 0) return [];
  const top = Math.max(...list.map((x) => x.avg));
  return list
    .sort((a, b) => a.hour - b.hour)
    .map((x) => ({
      hour: x.hour,
      engagement:
        x.avg >= top * 0.66 ? 'high' : x.avg >= top * 0.33 ? 'medium' : 'low',
    }));
}

function computeAvgCaptionLength(media: IgMedia[]): number {
  const lengths = media.map((m) => (m.caption ?? '').length).filter((n) => n > 0);
  if (lengths.length === 0) return 0;
  return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
}

function computeEngagementTrend(media: IgMedia[]): EngagementTrend {
  if (media.length < 6) return 'stable';
  const sorted = [...media].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
  const half = Math.floor(sorted.length / 2);
  const a = avgInteractions(sorted.slice(0, half));
  const b = avgInteractions(sorted.slice(half));
  if (a === 0) return 'stable';
  const diff = (b - a) / a;
  if (diff > 0.15) return 'improving';
  if (diff < -0.15) return 'declining';
  return 'stable';
}

function computeGrowth(
  trend: { date: string; count: number }[],
  currentFollowers: number
): { growthRate: string; growthTrend: GrowthTrend; projectedFollowers30Days: number | null } {
  if (trend.length < 2) {
    return {
      growthRate: 'No follower history yet',
      growthTrend: 'unknown',
      projectedFollowers30Days: null,
    };
  }
  const first = trend[0].count;
  const last = trend[trend.length - 1].count;
  const days = Math.max(trend.length - 1, 1);
  const dailyDelta = (last - first) / days;
  const pct = first > 0 ? ((last - first) / first) * 100 : 0;
  const sign = pct >= 0 ? '+' : '';
  const growthRate = `${sign}${pct.toFixed(2)}% over ${days} day${days === 1 ? '' : 's'}`;
  // Trend: compare second-half slope to first-half slope.
  let growthTrend: GrowthTrend = 'steady';
  if (trend.length >= 6) {
    const half = Math.floor(trend.length / 2);
    const earlySlope = (trend[half].count - trend[0].count) / Math.max(half, 1);
    const lateSlope = (trend[trend.length - 1].count - trend[half].count) / Math.max(trend.length - 1 - half, 1);
    if (lateSlope > earlySlope * 1.2) growthTrend = 'accelerating';
    else if (lateSlope < earlySlope * 0.8 || lateSlope < 0) growthTrend = 'declining';
  } else if (last < first) {
    growthTrend = 'declining';
  }
  const projected = Math.round((currentFollowers || last) + dailyDelta * 30);
  return { growthRate, growthTrend, projectedFollowers30Days: Math.max(projected, 0) };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreContentQuality(recent30: IgMedia[], followers: number): number {
  if (recent30.length === 0) return 50;
  if (followers <= 0) return 50;
  const avgEng = avgInteractions(recent30) / followers;
  // 5%+ → 90, 3% → 70, 1% → 40.
  const pct = avgEng * 100;
  if (pct >= 5) return clamp(80 + (pct - 5) * 2, 80, 98);
  if (pct >= 2) return clamp(60 + (pct - 2) * 6.6, 60, 80);
  return clamp(30 + pct * 15, 30, 60);
}

function scorePostingConsistency(recent30: IgMedia[]): number {
  if (recent30.length === 0) return 30;
  const perWeek = (recent30.length / 30) * 7;
  if (perWeek >= 5) return 90;
  if (perWeek >= 4) return 80;
  if (perWeek >= 3) return 70;
  if (perWeek >= 2) return 55;
  if (perWeek >= 1) return 40;
  return 25;
}

function scoreEngagementRate(eng: number): number {
  if (eng >= 7) return 95;
  if (eng >= 5) return 88;
  if (eng >= 3) return 75;
  if (eng >= 2) return 65;
  if (eng >= 1) return 50;
  return 35;
}

function scoreHashtagStrategy(stats: HashtagStat[], overused: string[]): number {
  if (stats.length === 0) return 50;
  // Reward diversity (≥ 8 distinct tags), penalize overuse.
  const diversity = Math.min(stats.length / 12, 1) * 50;
  const overusePenalty = Math.min(overused.length, 5) * 5;
  return clamp(50 + diversity - overusePenalty, 30, 95);
}

function scoreAudienceGrowth(trend: GrowthTrend, points: { count: number }[]): number {
  if (points.length < 2) return 60;
  if (trend === 'accelerating') return 92;
  if (trend === 'steady') return 75;
  if (trend === 'declining') return 40;
  return 60;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// ---------------------------------------------------------------------------
// Claude narrative — single call that fills every prose field at once.
// ---------------------------------------------------------------------------

interface NarrativePayload {
  recommendedHashtags?: string[];
  contentPreferences?: string;
  topEngagementDrivers?: string[];
  engagementKillers?: string[];
  bestCaptionStyle?: string;
  emojiUsage?: string;
  thisWeekPlan?: PlanDay[];
  competitorInsights?: CompetitorInsightBlock;
}

const NARRATIVE_SYSTEM = `You are an Instagram strategist briefing a solo creator. You receive aggregated stats and a sample of their recent posts. Produce SPECIFIC, data-grounded analysis — cite numbers and caption fragments. No platitudes ("post consistently", "use trending audio").

Return STRICT JSON, no prose or fences:
{
  "recommendedHashtags": ["6-10 specific tags this creator should test, tied to their niche signal in the captions"],
  "contentPreferences": "1-2 sentences on what their audience seems to want — cite a specific pattern from the data",
  "topEngagementDrivers": ["3-5 concrete drivers — caption styles, hook types, formats — cite specifics"],
  "engagementKillers": ["2-4 specific patterns that are hurting them — cite at least one example"],
  "bestCaptionStyle": "one phrase describing their best caption pattern (length + structure)",
  "emojiUsage": "one phrase — under/over/balanced, with implication",
  "thisWeekPlan": [
    { "day": "Monday", "action": "concrete post idea + format", "reason": "specific data-backed why" },
    ...3-5 entries total, weekdays only
  ],
  "competitorInsights": null | {
    "youPostMore": true | false,
    "theyGetMoreEngagement": true | false,
    "keyDifference": "1 sentence — what they do that you don't",
    "stealableStrategy": "1 sentence — concrete tactic to copy"
  }
}

Return competitorInsights = null when no competitor data is provided. Aim the thisWeekPlan at the slots in bestPostingTimes — match the day field to one of those days when possible.`;

async function runNarrativeAnalysis(
  payload: object
): Promise<{ narrative: NarrativePayload; partial: boolean }> {
  try {
    const narrative = await callClaude<NarrativePayload>({
      systemPrompt: NARRATIVE_SYSTEM,
      userMessage: `Analyse this creator and return the JSON:\n\n${JSON.stringify(payload, null, 2)}`,
      maxTokens: 2400,
    });
    return { narrative, partial: false };
  } catch (e) {
    console.warn(`Intelligence narrative call failed: ${(e as Error).message}`);
    return { narrative: {}, partial: true };
  }
}

// ---------------------------------------------------------------------------
// Empty shape — for the not-connected / first-load path.
// ---------------------------------------------------------------------------

export function empty(connected: boolean): ProfileIntelligence {
  return {
    connected,
    generatedAt: null,
    windowDays: 30,
    bestPostingTimes: [],
    worstPostingTimes: [],
    optimalFrequency: '',
    contentBreakdown: {
      reels: { count: 0, avgEngagement: 0, trend: 'stable' },
      posts: { count: 0, avgEngagement: 0, trend: 'stable' },
      carousels: { count: 0, avgEngagement: 0, trend: 'stable' },
      stories: { count: 0, avgEngagement: 0, trend: 'stable' },
    },
    topPerformingType: null,
    hashtagEffectiveness: [],
    recommendedHashtags: [],
    overusedHashtags: [],
    audienceActiveHours: [],
    contentPreferences: '',
    growthRate: '',
    growthTrend: 'unknown',
    projectedFollowers30Days: null,
    avgEngagementRate: 0,
    engagementTrend: 'stable',
    topEngagementDrivers: [],
    engagementKillers: [],
    avgCaptionLength: 0,
    bestCaptionStyle: '',
    emojiUsage: '',
    thisWeekPlan: [],
    competitorInsights: null,
    profileHealthScore: 0,
    scoreBreakdown: {
      contentQuality: 0,
      postingConsistency: 0,
      engagementRate: 0,
      hashtagStrategy: 0,
      audienceGrowth: 0,
    },
  };
}
