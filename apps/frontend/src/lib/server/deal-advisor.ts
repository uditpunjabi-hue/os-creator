import 'server-only';
import { callClaude, ClaudeError } from './anthropic';

export interface DealAdvice {
  score: number; // 0-100
  verdict: 'STRONG' | 'FAIR' | 'WEAK' | 'WALK_AWAY';
  counterOffer: number | null;
  counterReasoning: string;
  redFlags: string[];
  marketBenchmark: string;
  negotiationPoints: string[];
  partial?: boolean;
}

interface AdviseArgs {
  brand: string;
  offer: number;
  floor: number | null;
  ceiling: number | null;
  currency: string;
  influencer: {
    name: string;
    handle: string | null;
    followers: number | null;
    engagement: number | null;
  };
  notes: string | null;
  rateCard: {
    reelRate?: number | null;
    storyRate?: number | null;
    carouselRate?: number | null;
    ugcRate?: number | null;
    brandIntegRate?: number | null;
    exclusivityRate?: number | null;
  } | null;
  similarDeals: Array<{
    brand: string;
    offer: number;
    stage: string;
    closedAt?: string | null;
  }>;
}

const SYSTEM = `You are a no-nonsense talent manager advising a creator on a brand deal. Score it from the creator's side. Be specific, cite numbers, and never invent stats not in the input.

Score guide:
  - 85-100 STRONG: above rate card + clean terms — accept or upsell
  - 65-84 FAIR: in market — counter or negotiate scope
  - 40-64 WEAK: below benchmark — push hard or pass
  - 0-39 WALK_AWAY: red flags or insulting offer

Return STRICT JSON, no prose or fences:
{
  "score": 72,
  "verdict": "STRONG | FAIR | WEAK | WALK_AWAY",
  "counterOffer": 45000 | null,
  "counterReasoning": "1-2 sentences citing rate card / market / influencer stats",
  "redFlags": ["specific things to watch — exclusivity terms, payment delays, usage rights, etc. Skip if none."],
  "marketBenchmark": "1 sentence — how this compares to similar deals in the influencer's tier",
  "negotiationPoints": ["3-5 concrete asks beyond price: usage rights window, exclusivity carve-outs, payment terms, content approval, etc."]
}

counterOffer is null only when the deal is already STRONG and you wouldn't counter on price.`;

const FALLBACK = (a: AdviseArgs): DealAdvice => {
  // Deterministic, conservative fallback when the LLM call times out. Uses
  // floor/ceiling + rate-card hints if available.
  const reel = a.rateCard?.reelRate ?? null;
  const ref = a.ceiling ?? reel ?? a.floor ?? a.offer;
  let score = 60;
  if (a.floor && a.offer < a.floor) score = 25;
  else if (reel && a.offer >= reel) score = 80;
  else if (a.offer >= ref) score = 75;
  const verdict: DealAdvice['verdict'] =
    score >= 85 ? 'STRONG' : score >= 65 ? 'FAIR' : score >= 40 ? 'WEAK' : 'WALK_AWAY';
  const counter =
    score < 80 ? Math.round(Math.max(a.floor ?? a.offer * 1.15, ref) / 1000) * 1000 : null;
  return {
    score,
    verdict,
    counterOffer: counter,
    counterReasoning: counter
      ? `Counter at ${a.currency} ${counter.toLocaleString()} — anchors to ${a.floor ? 'your floor' : 'a comparable benchmark'} for ${a.influencer.followers?.toLocaleString() ?? 'creators in this tier'}.`
      : 'Offer is at or above the comparable benchmark — accept or upsell on deliverables.',
    redFlags: [],
    marketBenchmark: a.rateCard
      ? `Reel benchmark on file: ${a.currency} ${(reel ?? 0).toLocaleString()}. Offer is ${(a.offer / Math.max(reel ?? 1, 1)).toFixed(2)}× that.`
      : 'No rate card on file — set one in Settings for sharper comparisons.',
    negotiationPoints: [
      'Lock usage rights to 90 days unless they pay for organic-only extension',
      'Carve out non-competing brands from exclusivity',
      '50% upfront on signing, balance NET30 from delivery',
    ],
    partial: true,
  };
};

export async function adviseOnDeal(args: AdviseArgs): Promise<DealAdvice> {
  try {
    const result = await callClaude<Omit<DealAdvice, 'partial'>>({
      systemPrompt: SYSTEM,
      userMessage: `Analyse this deal and return the JSON:\n\n${JSON.stringify(args, null, 2)}`,
      maxTokens: 1200,
      timeoutMs: 25_000,
    });
    return { ...result, partial: false };
  } catch (e) {
    if (e instanceof ClaudeError && e.status === 504) {
      console.warn('Deal advisor timed out — using deterministic fallback');
    } else {
      console.warn(`Deal advisor failed: ${(e as Error).message}`);
    }
    return FALLBACK(args);
  }
}
