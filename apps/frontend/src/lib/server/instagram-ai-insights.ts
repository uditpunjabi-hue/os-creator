import 'server-only';
import { getInstagramProfile } from './instagram';
import { callClaude } from './anthropic';
import { memoryCache } from './memory-cache';

export interface AiInsightCard {
  title: string;
  detail: string;
  suggestedPrompt: string;
}

export interface AiInsightsResponse {
  connected: boolean;
  generatedAt: string | null;
  contentDna: AiInsightCard[];
  growthOpportunities: AiInsightCard[];
  audiencePulse: AiInsightCard[];
  contentGaps: AiInsightCard[];
}

const CACHE_KEY = (orgId: string) => `ig:ai-insights:${orgId}`;
// Hard TTL — drop the entry entirely after 24h.
const CACHE_TTL = 24 * 60 * 60;
// Soft TTL — after 6h, still serve cached BUT kick off a background refresh
// so the next reader gets fresh data without paying the Claude-call latency.
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

// In-flight de-dup: if a background refresh is already running for an org,
// don't fire another. Per-process — fine for the SWR use case.
const inFlight = new Map<string, Promise<AiInsightsResponse>>();

const SYSTEM_PROMPT = `You are the AI creative director for a solo content creator.
Given the creator's Instagram profile and a sample of recent posts (captions + engagement),
produce four distinct analyses. Be SPECIFIC — cite caption fragments, numbers, formats —
NOT generic platitudes ("post consistently", "use trending audio").

Each card has the same shape:
  - title: short headline, < 60 chars
  - detail: 1-2 sentences, concrete and tied to the data we gave you
  - suggestedPrompt: a one-sentence prompt the creator can paste into our AI
    script generator to act on this insight. Should be specific enough that
    the script writer can produce a real piece. Phrase it from the creator's POV.

Return STRICT JSON, no prose or markdown fences:
{
  "contentDna": [
    {"title": "...", "detail": "...", "suggestedPrompt": "..."}
  ],
  "growthOpportunities": [...],
  "audiencePulse": [...],
  "contentGaps": [...]
}

Aim for 2-3 cards per category. If a category is genuinely empty for this
creator's data, return [] rather than padding with generics.`;

export async function getAiInsights(orgId: string, force = false): Promise<AiInsightsResponse> {
  if (!force) {
    const cached = memoryCache.get<AiInsightsResponse>(CACHE_KEY(orgId));
    if (cached) {
      // Stale-while-revalidate: if the cached entry is older than the soft TTL,
      // kick off a refresh in the background so the next reader is fast. The
      // current reader still gets the cached payload immediately.
      const generatedAt = cached.generatedAt ? Date.parse(cached.generatedAt) : 0;
      if (generatedAt && Date.now() - generatedAt > STALE_AFTER_MS) {
        triggerBackgroundRefresh(orgId);
      }
      return cached;
    }
  }
  return regenerate(orgId);
}

function triggerBackgroundRefresh(orgId: string) {
  if (inFlight.has(orgId)) return;
  const p = regenerate(orgId).catch((e) => {
    console.warn(`AI insights background refresh failed: ${(e as Error).message}`);
    // Return the (now stale) cached value so callers waiting on this promise
    // never get a rejected promise. They'll still see the prior insights.
    return memoryCache.get<AiInsightsResponse>(CACHE_KEY(orgId)) ?? {
      connected: false,
      generatedAt: null,
      contentDna: [],
      growthOpportunities: [],
      audiencePulse: [],
      contentGaps: [],
    };
  });
  inFlight.set(orgId, p);
  void p.finally(() => inFlight.delete(orgId));
}

async function regenerate(orgId: string): Promise<AiInsightsResponse> {
  // De-dup concurrent calls — multiple page loads racing for the same org all
  // share one Claude call.
  const existing = inFlight.get(orgId);
  if (existing) return existing;

  const work = (async (): Promise<AiInsightsResponse> => {
    const profile = await getInstagramProfile(orgId);
    if (!profile.connected) {
      return {
        connected: false,
        generatedAt: null,
        contentDna: [],
        growthOpportunities: [],
        audiencePulse: [],
        contentGaps: [],
      };
    }

    const userPayload = {
      handle: profile.handle,
      followers: profile.followers,
      mediaCount: profile.mediaCount,
      bio: profile.bio,
      engagementRate: profile.engagementRate,
      recentPosts: profile.recentMedia.map((m) => ({
        type: m.mediaType,
        caption: (m.caption ?? '').slice(0, 300),
        likes: m.likeCount,
        comments: m.commentsCount,
        timestamp: m.timestamp,
      })),
    };

    let parsed: Omit<AiInsightsResponse, 'connected' | 'generatedAt'>;
    try {
      parsed = await callClaude<Omit<AiInsightsResponse, 'connected' | 'generatedAt'>>({
        systemPrompt: SYSTEM_PROMPT,
        userMessage: `Analyze this creator and return the four-category JSON:\n\n${JSON.stringify(userPayload, null, 2)}`,
        maxTokens: 2000,
      });
    } catch (e) {
      console.warn(`AI insights generation failed: ${(e as Error).message}`);
      parsed = { contentDna: [], growthOpportunities: [], audiencePulse: [], contentGaps: [] };
    }

    const out: AiInsightsResponse = {
      connected: true,
      generatedAt: new Date().toISOString(),
      contentDna: parsed.contentDna ?? [],
      growthOpportunities: parsed.growthOpportunities ?? [],
      audiencePulse: parsed.audiencePulse ?? [],
      contentGaps: parsed.contentGaps ?? [],
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
