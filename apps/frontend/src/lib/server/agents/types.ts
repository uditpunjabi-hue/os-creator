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

export interface AgentOutputs {
  profile?: ProfileAnalysis;
  competitor?: CompetitorAnalysis;
  trends?: TrendAnalysis;
  strategy?: StrategyBrief;
  script?: ScriptDraft;
  quality?: QualityReview;
  revisedScript?: ScriptDraft;
  revisedQuality?: QualityReview;
}

export type PipelineEvent =
  | { kind: 'pipeline_start'; stages: PipelineStage[] }
  | { kind: 'agent_start'; agent: keyof AgentOutputs; stage: PipelineStage }
  | { kind: 'agent_done'; agent: keyof AgentOutputs; stage: PipelineStage; output: unknown }
  | { kind: 'agent_error'; agent: keyof AgentOutputs; stage: PipelineStage; error: string }
  | { kind: 'pipeline_done'; scriptId: string; outputs: AgentOutputs }
  | { kind: 'pipeline_error'; error: string };
