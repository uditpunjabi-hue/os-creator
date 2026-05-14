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
import type { ProfileIntelligence } from './profile-intelligence.agent';

const SYSTEM_PROMPT = `You are a content strategy expert. Given a creator's profile analysis, competitor intelligence, trend data, and the creator's content request, create a detailed content strategy brief.

When MASTER INTELLIGENCE is provided, treat it as ground truth about what works for THIS creator — it contains real numbers (best posting times, top-performing format, recommended hashtags, engagement drivers/killers). Tailor the brief to those specifics: pick a format their data says works, hint at hooks that beat their average, and avoid the engagementKillers list.

Return STRICT JSON with this exact shape — no prose, no markdown fences:
{
  "contentAngle": "the specific take this piece will own (1 sentence)",
  "format": "concrete format choice e.g. 'Reel, 30s, 5-cut walkthrough'",
  "tone": "creator-voice tone description (1 phrase)",
  "targetEmotion": "the single emotion the piece should land in the viewer",
  "hookStyle": "specific opening pattern",
  "estimatedPerformance": "honest take vs creator's recent average — cite the avgEngagementRate from intel if given",
  "keyMessage": "the one idea the viewer walks away with",
  "differentiator": "why this beats the closest competitor angle (cite the competitor)"
}

This brief is the spec the script writer will execute against. Be specific enough that a writer cannot misinterpret. No hedging.`;

// Lean projection — only the fields the Strategy Architect actually uses,
// keeping the prompt small (the full intelligence blob is ~3KB).
function projectIntel(intel: ProfileIntelligence) {
  return {
    topPerformingType: intel.topPerformingType,
    avgEngagementRate: intel.avgEngagementRate,
    bestPostingTimes: intel.bestPostingTimes.slice(0, 3),
    contentBreakdown: intel.contentBreakdown,
    topEngagementDrivers: intel.topEngagementDrivers,
    engagementKillers: intel.engagementKillers,
    bestCaptionStyle: intel.bestCaptionStyle,
    recommendedHashtags: intel.recommendedHashtags.slice(0, 8),
    overusedHashtags: intel.overusedHashtags,
  };
}

export async function runStrategyArchitect(
  profile: ProfileAnalysis,
  competitor: CompetitorAnalysis,
  trends: TrendAnalysis,
  request: { prompt: string; contentType: ContentType; tone: Tone },
  intel?: ProfileIntelligence | null
): Promise<StrategyBrief> {
  const sections = [
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
  ];
  if (intel && intel.connected) {
    sections.push(
      '',
      'MASTER INTELLIGENCE (ground truth — use to anchor format, hook, hashtags, and timing):',
      JSON.stringify(projectIntel(intel), null, 2)
    );
  }
  sections.push('', 'Synthesize all of the above into a single strategy brief.');

  return callClaude<StrategyBrief>({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: sections.join('\n'),
    maxTokens: 1024,
  });
}
