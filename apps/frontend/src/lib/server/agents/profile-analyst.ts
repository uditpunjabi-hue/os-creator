import 'server-only';
import { callClaude } from '../anthropic';
import type { CreatorProfile, ProfileAnalysis } from './types';

const SYSTEM_PROMPT = `You are a social media profile analyst. Given an Instagram creator's data (followers, engagement rate, top posts, posting times, audience demographics), analyze what content performs best for them.

Return STRICT JSON with this exact shape — no prose, no markdown fences:
{
  "strengths": ["bullet, < 14 words each"],
  "weaknesses": ["bullet, < 14 words each"],
  "bestContentTypes": ["e.g. Reels, Carousels, BTS clips"],
  "bestPostingTimes": ["e.g. Tue 6:30 PM IST", "Thu 7:00 PM IST"],
  "audienceInsights": "2-3 sentence narrative about the audience: who they are, what they want from this creator, where the brand affinity lies",
  "recommendations": ["concrete, actionable, < 18 words each"]
}

Be specific. Pull numbers and post titles from the input data. Avoid generic advice.`;

export async function runProfileAnalyst(profile: CreatorProfile): Promise<ProfileAnalysis> {
  return callClaude<ProfileAnalysis>({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Analyze this creator profile and return a structured analysis.\n\n${JSON.stringify(profile, null, 2)}`,
    maxTokens: 1024,
  });
}
