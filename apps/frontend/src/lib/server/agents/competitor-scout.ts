import 'server-only';
import { callClaude } from '../anthropic';
import type { CompetitorAnalysis, CompetitorBrief, ProfileAnalysis } from './types';

const SYSTEM_PROMPT = `You are a competitive intelligence analyst for social media. Given a list of competitor profiles and their content data, identify what's working for them, what content gaps exist, and what the creator can learn.

Return STRICT JSON with this exact shape — no prose, no markdown fences:
{
  "topCompetitorStrategies": ["concrete strategy with handle attribution, < 22 words each"],
  "viralHooks": ["specific opening line patterns observed in competitor content"],
  "contentGaps": ["topics/formats the competitors are NOT serving — the creator's opening"],
  "opportunities": ["actionable angles for the creator to take, < 22 words each"],
  "keyTakeaway": "single sentence: the highest-leverage move based on this scan"
}

Cite specific competitor handles when you reference a strategy. Be ruthless about generic claims.`;

export async function runCompetitorScout(
  competitors: CompetitorBrief[],
  profileAnalysis: ProfileAnalysis
): Promise<CompetitorAnalysis> {
  return callClaude<CompetitorAnalysis>({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: [
      "Scout the competition. Cross-reference each competitor against the creator's already-known strengths/weaknesses below — flag gaps and opportunities.",
      '',
      'Creator profile analysis (from previous step):',
      JSON.stringify(profileAnalysis, null, 2),
      '',
      'Competitors:',
      JSON.stringify(competitors, null, 2),
    ].join('\n'),
    maxTokens: 1024,
  });
}
