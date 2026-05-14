import 'server-only';
import { callClaude } from '../anthropic';
import type {
  CompetitorAnalysis,
  ContentType,
  ProfileAnalysis,
  StrategyBrief,
  Tone,
  TrendAnalysis,
} from './types';

const SYSTEM_PROMPT = `You are a content strategy expert. Given a creator's profile analysis, competitor intelligence, trend data, and the creator's content request, create a detailed content strategy brief.

Return STRICT JSON with this exact shape — no prose, no markdown fences:
{
  "contentAngle": "the specific take this piece will own (1 sentence)",
  "format": "concrete format choice e.g. 'Reel, 30s, 5-cut walkthrough'",
  "tone": "creator-voice tone description (1 phrase)",
  "targetEmotion": "the single emotion the piece should land in the viewer",
  "hookStyle": "specific opening pattern",
  "estimatedPerformance": "honest take vs creator's recent average",
  "keyMessage": "the one idea the viewer walks away with",
  "differentiator": "why this beats the closest competitor angle (cite the competitor)"
}

This brief is the spec the script writer will execute against. Be specific enough that a writer cannot misinterpret. No hedging.`;

export async function runStrategyArchitect(
  profile: ProfileAnalysis,
  competitor: CompetitorAnalysis,
  trends: TrendAnalysis,
  request: { prompt: string; contentType: ContentType; tone: Tone }
): Promise<StrategyBrief> {
  return callClaude<StrategyBrief>({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: [
      `Creator request: ${request.prompt}`,
      `Requested format: ${request.contentType}`,
      `Requested tone: ${request.tone}`,
      '',
      'Profile analysis:',
      JSON.stringify(profile, null, 2),
      '',
      'Competitor analysis:',
      JSON.stringify(competitor, null, 2),
      '',
      'Trend analysis:',
      JSON.stringify(trends, null, 2),
      '',
      'Synthesize all of the above into a single strategy brief.',
    ].join('\n'),
    maxTokens: 1024,
  });
}
