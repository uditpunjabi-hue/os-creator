'use client';

import useSWR, { type SWRConfiguration } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

// ---------------------------------------------------------------------------
// SWR setup for the creator-facing pages.
//
// SWR is configured to (a) show cached data instantly across navigations,
// (b) dedupe identical requests fired within 1 min — so Profile and Analytics
// sharing /creator/profile only fetch once — and (c) NOT revalidate on focus
// because the data sources (IG, Claude, GCal) are themselves cached on the
// server with their own TTLs; refetching every focus is just churn.
//
// Each hook is a thin wrapper that keys SWR by URL and uses the customFetch
// from context so auth cookies + the API base prefix go through one path.
// ---------------------------------------------------------------------------

const sharedConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  // 1-minute in-process dedupe is comfortably longer than a page render and
  // a few quick navigations, but short enough that a manual refresh feels
  // responsive.
  dedupingInterval: 60_000,
  // Keep previous data visible while a revalidation runs — no skeleton flash
  // on tab switch.
  keepPreviousData: true,
};

function useApi<T>(key: string | null, config?: SWRConfiguration) {
  const fetch = useFetch();
  return useSWR<T>(
    key,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${url} ${res.status}: ${text.slice(0, 200)}`);
      }
      return (await res.json()) as T;
    },
    { ...sharedConfig, ...config }
  );
}

// ---------------------------------------------------------------------------
// Shape mirrors used by the hooks — kept local so consumers can import the
// hook + the type from one place.
// ---------------------------------------------------------------------------

export interface IgMedia {
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

export interface IgProfile {
  connected: boolean;
  handle: string | null;
  followers: number | null;
  mediaCount: number | null;
  bio: string | null;
  profilePic: string | null;
  engagementRate: number | null;
  recentMedia: IgMedia[];
}

export interface InsightsResponse {
  connected: boolean;
  engagementRate: number | null;
  contentTypePerformance: Array<{
    format: 'Reel' | 'Carousel' | 'Image' | 'Story';
    count: number;
    avgInteractions: number;
    avgEngagementPct: number;
  }>;
  bestTimes: Array<{ weekday: string; hour: number; avgInteractions: number; posts: number }>;
  followerTrend: Array<{ date: string; count: number }>;
  insights: Array<{ kind: 'good' | 'warn'; title: string; detail: string }>;
}

export interface AiInsightsResponse {
  connected: boolean;
  generatedAt: string | null;
  contentDna: Array<{ title: string; detail: string; suggestedPrompt: string }>;
  growthOpportunities: Array<{ title: string; detail: string; suggestedPrompt: string }>;
  audiencePulse: Array<{ title: string; detail: string; suggestedPrompt: string }>;
  contentGaps: Array<{ title: string; detail: string; suggestedPrompt: string }>;
  partial?: boolean;
}

export interface WeeklyReportResponse {
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

export interface IntelligenceResponse {
  connected: boolean;
  generatedAt: string | null;
  bestPostingTimes: Array<{ day: string; time: string; avgEngagement: number }>;
  worstPostingTimes: Array<{ day: string; time: string; avgEngagement: number }>;
  optimalFrequency: string;
  contentBreakdown: {
    reels: { count: number; avgEngagement: number; trend: 'up' | 'down' | 'stable' };
    posts: { count: number; avgEngagement: number; trend: 'up' | 'down' | 'stable' };
    carousels: { count: number; avgEngagement: number; trend: 'up' | 'down' | 'stable' };
    stories: { count: number; avgEngagement: number; trend: 'up' | 'down' | 'stable' };
  };
  topPerformingType: 'reels' | 'posts' | 'carousels' | 'stories' | null;
  hashtagEffectiveness: Array<{ hashtag: string; avgReach: number; frequency: number }>;
  recommendedHashtags: string[];
  overusedHashtags: string[];
  audienceActiveHours: Array<{ hour: number; engagement: 'high' | 'medium' | 'low' }>;
  growthRate: string;
  growthTrend: 'accelerating' | 'steady' | 'declining' | 'unknown';
  projectedFollowers30Days: number | null;
  avgEngagementRate: number;
  engagementTrend: 'improving' | 'stable' | 'declining';
  topEngagementDrivers: string[];
  engagementKillers: string[];
  thisWeekPlan: Array<{ day: string; action: string; reason: string }>;
  competitorInsights: {
    youPostMore: boolean;
    theyGetMoreEngagement: boolean;
    keyDifference: string;
    stealableStrategy: string;
  } | null;
  profileHealthScore: number;
  scoreBreakdown: {
    contentQuality: number;
    postingConsistency: number;
    engagementRate: number;
    hashtagStrategy: number;
    audienceGrowth: number;
  };
  partial?: boolean;
}

export interface SchedulePayload {
  posts: Array<{
    id: string;
    caption: string;
    kind: string;
    status: 'SCHEDULED' | 'DRAFT' | 'PUBLISHED' | 'FAILED';
    platforms: string[];
    scheduledAt: string;
  }>;
  events: Array<{ id: string; title: string; startsAt: string }>;
  deadlines: Array<{
    id: string;
    brand: string;
    offer: number;
    deadline: string | null;
    stage: string;
  }>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useCreatorProfile() {
  return useApi<IgProfile>('/creator/profile');
}

export function useCreatorInsights() {
  return useApi<InsightsResponse>('/creator/insights');
}

// Lazy: only fires once `enabled` is true. Used after the profile loads + is
// confirmed connected, so we don't run Claude calls for a disconnected user.
export function useAiInsights(enabled: boolean) {
  return useApi<AiInsightsResponse>(enabled ? '/creator/ai-insights' : null);
}

export function useWeeklyReport(enabled: boolean) {
  return useApi<WeeklyReportResponse>(enabled ? '/creator/weekly-report' : null);
}

export function useIntelligence(enabled: boolean) {
  return useApi<IntelligenceResponse>(enabled ? '/creator/intelligence' : null);
}

export function useSchedule(fromYmd: string, toYmd: string) {
  return useApi<SchedulePayload>(`/creator/schedule?from=${fromYmd}&to=${toYmd}`);
}

// Convenience: trigger a fresh server-side compute (bypasses memoryCache) and
// then mutate the SWR cache with the result.
export async function forceRefresh<T>(
  url: string,
  fetcher: (path: string) => Promise<Response>,
  mutate: (data: T) => Promise<unknown>
): Promise<void> {
  const res = await fetcher(`${url}?refresh=1`);
  if (res.ok) {
    const data = (await res.json()) as T;
    await mutate(data);
  }
}
