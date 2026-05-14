import 'server-only';
import { callClaude } from '../anthropic';
import type {
  CompetitorAnalysis,
  CreatorProfile,
  ProfileAnalysis,
  QualityReview,
  ScriptDraft,
} from './types';

const SYSTEM_PROMPT = `You are a content quality reviewer and performance predictor. Given a script, the creator's profile data, and competitor benchmarks, score the script and predict performance.

Return STRICT JSON with this exact shape — no prose, no markdown fences:
{
  "qualityScore": 75,
  "predictedViews": "e.g. '120K–180K reach' — range based on creator's baseline",
  "predictedEngagement": "e.g. '6.4% — slightly above the creator's average'",
  "strengths": ["specific things the script does well, < 18 words each"],
  "improvements": ["specific, actionable fixes — leave out if no major issues"],
  "verdict": "PUBLISH" | "REVISE" | "RETHINK"
}

Score honestly. 90+ means truly excellent. 70-89 means publish with minor polish. 50-69 means revise. <50 means rethink the angle entirely. Anchor predictions to the creator's actual recent performance, NOT generic numbers.`;

export async function runQualityReviewer(
  script: ScriptDraft,
  profile: CreatorProfile,
  profileAnalysis: ProfileAnalysis,
  competitor?: CompetitorAnalysis
): Promise<QualityReview> {
  return callClaude<QualityReview>({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: [
      'Review this script. Be specific in praise AND critique.',
      '',
      'Script:',
      JSON.stringify(script, null, 2),
      '',
      'Creator profile (raw):',
      JSON.stringify(profile, null, 2),
      '',
      'Creator profile analysis:',
      JSON.stringify(profileAnalysis, null, 2),
      ...(competitor
        ? ['', 'Competitor benchmark:', JSON.stringify(competitor, null, 2)]
        : []),
    ].join('\n'),
    maxTokens: 1024,
  });
}
