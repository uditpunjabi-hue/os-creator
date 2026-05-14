// Shared types passed between the 6 pipeline agents.

export type ContentType = 'reel' | 'post' | 'story' | 'carousel';
export type Tone = 'educational' | 'entertaining' | 'inspirational' | 'promotional';

export interface CreatorProfile {
  handle: string;
  platform: string;
  followers: number;
  engagement: number;
  bio?: string | null;
  niche: string;
  topPosts: Array<{ caption: string; reach?: number; engagement?: number }>;
  bestPostingTimes?: string[];
}

export interface CompetitorBrief {
  handle: string;
  platform: string;
  followers?: number | null;
  engagement?: number | null;
  growth30d?: number | null;
  notes?: string | null;
}

export interface ProfileAnalysis {
  strengths: string[];
  weaknesses: string[];
  bestContentTypes: string[];
  bestPostingTimes: string[];
  audienceInsights: string;
  recommendations: string[];
}

export interface CompetitorAnalysis {
  topCompetitorStrategies: string[];
  viralHooks: string[];
  contentGaps: string[];
  opportunities: string[];
  keyTakeaway: string;
}

export interface TrendAnalysis {
  trendingFormats: string[];
  hotTopics: string[];
  recommendedHashtags: string[];
  trendingAudio: string[];
  timingAdvice: string;
}

export interface StrategyBrief {
  contentAngle: string;
  format: string;
  tone: string;
  targetEmotion: string;
  hookStyle: string;
  estimatedPerformance: string;
  keyMessage: string;
  differentiator: string;
}

export interface ScriptDraft {
  title: string;
  hook: string;
  body: string;
  cta: string;
  caption: string;
  hashtags: string[];
  estimatedDuration: string;
  filmingNotes: string;
}

export type Verdict = 'PUBLISH' | 'REVISE' | 'RETHINK';

export interface QualityReview {
  qualityScore: number;
  predictedViews: string;
  predictedEngagement: string;
  strengths: string[];
  improvements: string[];
  verdict: Verdict;
}

export interface PipelineRequest {
  prompt: string;
  contentType: ContentType;
  tone: Tone;
}

export type PipelineStage =
  | 'ANALYZING'
  | 'SCOUTING'
  | 'TRENDING'
  | 'STRATEGIZING'
  | 'WRITING'
  | 'REVIEWING'
  | 'REVISING'
  | 'COMPLETE';

export interface RevisionAttempt {
  attempt: number; // 2, 3, ... — attempt 1 is the initial script/quality pair
  script: ScriptDraft;
  quality: QualityReview;
}

export interface AgentOutputs {
  profile?: ProfileAnalysis;
  competitor?: CompetitorAnalysis;
  trends?: TrendAnalysis;
  strategy?: StrategyBrief;
  script?: ScriptDraft;
  quality?: QualityReview;
  // Final picked revision — convenience pointer into the best entry of
  // `revisions` so existing readers (e.g. the approve endpoint) don't have
  // to know about the auto-rewrite loop.
  revisedScript?: ScriptDraft;
  revisedQuality?: QualityReview;
  revisions?: RevisionAttempt[];
}

export type PipelineEvent =
  | { kind: 'pipeline_start'; stages: PipelineStage[] }
  | { kind: 'agent_start'; agent: keyof AgentOutputs; stage: PipelineStage }
  | { kind: 'agent_done'; agent: keyof AgentOutputs; stage: PipelineStage; output: unknown }
  | { kind: 'agent_error'; agent: keyof AgentOutputs; stage: PipelineStage; error: string }
  // Auto-rewrite loop progress. Emitted alongside agent_start/agent_done so the
  // UI can render the "Score 65 → improving → Attempt 2: 72 → ..." trail.
  | {
      kind: 'revision_attempt';
      attempt: number;
      status: 'started' | 'done';
      score?: number;
      final?: boolean;
    }
  | { kind: 'pipeline_done'; scriptId: string; outputs: AgentOutputs }
  | { kind: 'pipeline_error'; error: string };
