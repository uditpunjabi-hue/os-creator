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
const CACHE_TTL = 30 * 60;

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
    if (cached) return cached;
  }

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
}
