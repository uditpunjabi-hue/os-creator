import 'server-only';
import { callClaude } from '../anthropic';
import type { ProfileAnalysis, TrendAnalysis } from './types';

const SYSTEM_PROMPT = `You are a social media trend analyst. Given a content niche and current date, identify trending formats, audio trends, hashtags, and timely topics. Lean on what you know about the platform's recent (last 60–90 days) momentum and seasonal angles around the given date.

Return STRICT JSON with this exact shape — no prose, no markdown fences:
{
  "trendingFormats": ["specific format with name, < 16 words each"],
  "hotTopics": ["timely subject lines the niche is leaning into right now"],
  "recommendedHashtags": ["15-20 hashtags, mix broad and niche, no fluff"],
  "trendingAudio": ["audio names + brief why-it-works note"],
  "timingAdvice": "single sentence on when/how to publish to ride the wave"
}

Be concrete about what's hot RIGHT NOW for the given niche. If you can't be specific, say so plainly inside the field rather than padding with generalities.`;

export async function runTrendDetector(
  niche: string,
  date: string,
  profileAnalysis: ProfileAnalysis
): Promise<TrendAnalysis> {
  return callClaude<TrendAnalysis>({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: [
      `Niche: ${niche}`,
      `Today's date: ${date}`,
      '',
      'Creator profile analysis (from previous step):',
      JSON.stringify(profileAnalysis, null, 2),
      '',
      "Identify the trends most relevant to this creator's positioning.",
    ].join('\n'),
    maxTokens: 1024,
  });
}
