import 'server-only';
import { prisma } from '../prisma';
import { runProfileAnalyst } from './profile-analyst';
import { runCompetitorScout } from './competitor-scout';
import { runTrendDetector } from './trend-detector';
import { runStrategyArchitect } from './strategy-architect';
import { runScriptWriter } from './script-writer';
import { runQualityReviewer } from './quality-reviewer';
import type {
  AgentOutputs,
  CompetitorBrief,
  CreatorProfile,
  PipelineEvent,
  PipelineRequest,
  PipelineStage,
  ScriptDraft,
} from './types';

const AUTO_REVISE_THRESHOLD = 70;
const NICHE_FALLBACK = 'short-form video creator (filmmaking, AI tools, creator workflow)';

/**
 * Drives the 6-agent pipeline, yielding NDJSON-friendly events.
 * On agent failure yields pipeline_error and stops.
 * On success yields pipeline_done with the persisted Script id.
 */
export async function* runPipeline(
  organizationId: string,
  userId: string,
  request: PipelineRequest
): AsyncGenerator<PipelineEvent> {
  yield {
    kind: 'pipeline_start',
    stages: ['ANALYZING', 'SCOUTING', 'TRENDING', 'STRATEGIZING', 'WRITING', 'REVIEWING'],
  };

  const outputs: AgentOutputs = {};
  const creatorProfile = await loadCreatorProfile(organizationId);
  const competitors = await loadCompetitors(organizationId);

  try {
    yield { kind: 'agent_start', agent: 'profile', stage: 'ANALYZING' };
    outputs.profile = await runProfileAnalyst(creatorProfile);
    yield { kind: 'agent_done', agent: 'profile', stage: 'ANALYZING', output: outputs.profile };
  } catch (e) {
    return yield* fail(e, 'profile', 'ANALYZING');
  }

  try {
    yield { kind: 'agent_start', agent: 'competitor', stage: 'SCOUTING' };
    outputs.competitor = await runCompetitorScout(competitors, outputs.profile!);
    yield { kind: 'agent_done', agent: 'competitor', stage: 'SCOUTING', output: outputs.competitor };
  } catch (e) {
    return yield* fail(e, 'competitor', 'SCOUTING');
  }

  try {
    yield { kind: 'agent_start', agent: 'trends', stage: 'TRENDING' };
    const today = new Date().toISOString().slice(0, 10);
    outputs.trends = await runTrendDetector(creatorProfile.niche, today, outputs.profile!);
    yield { kind: 'agent_done', agent: 'trends', stage: 'TRENDING', output: outputs.trends };
  } catch (e) {
    return yield* fail(e, 'trends', 'TRENDING');
  }

  try {
    yield { kind: 'agent_start', agent: 'strategy', stage: 'STRATEGIZING' };
    outputs.strategy = await runStrategyArchitect(
      outputs.profile!,
      outputs.competitor!,
      outputs.trends!,
      request
    );
    yield { kind: 'agent_done', agent: 'strategy', stage: 'STRATEGIZING', output: outputs.strategy };
  } catch (e) {
    return yield* fail(e, 'strategy', 'STRATEGIZING');
  }

  try {
    yield { kind: 'agent_start', agent: 'script', stage: 'WRITING' };
    outputs.script = await runScriptWriter(outputs.strategy!, request.prompt);
    yield { kind: 'agent_done', agent: 'script', stage: 'WRITING', output: outputs.script };
  } catch (e) {
    return yield* fail(e, 'script', 'WRITING');
  }

  try {
    yield { kind: 'agent_start', agent: 'quality', stage: 'REVIEWING' };
    outputs.quality = await runQualityReviewer(
      outputs.script!,
      creatorProfile,
      outputs.profile!,
      outputs.competitor!
    );
    yield { kind: 'agent_done', agent: 'quality', stage: 'REVIEWING', output: outputs.quality };
  } catch (e) {
    return yield* fail(e, 'quality', 'REVIEWING');
  }

  // Auto-revise once below threshold.
  if (outputs.quality!.qualityScore < AUTO_REVISE_THRESHOLD) {
    try {
      yield { kind: 'agent_start', agent: 'revisedScript', stage: 'REVISING' };
      const notes = outputs.quality!.improvements.join('\n- ');
      outputs.revisedScript = await runScriptWriter(
        outputs.strategy!,
        request.prompt,
        `Reviewer flagged score ${outputs.quality!.qualityScore}. Address:\n- ${notes}`
      );
      yield {
        kind: 'agent_done',
        agent: 'revisedScript',
        stage: 'REVISING',
        output: outputs.revisedScript,
      };

      yield { kind: 'agent_start', agent: 'revisedQuality', stage: 'REVIEWING' };
      outputs.revisedQuality = await runQualityReviewer(
        outputs.revisedScript,
        creatorProfile,
        outputs.profile!,
        outputs.competitor!
      );
      yield {
        kind: 'agent_done',
        agent: 'revisedQuality',
        stage: 'REVIEWING',
        output: outputs.revisedQuality,
      };
    } catch (e) {
      // Soft-fail revision: still save what we have.
      console.warn(`Auto-revise failed: ${(e as Error).message}`);
    }
  }

  const finalScript = pickFinal(outputs);
  const finalQuality = outputs.revisedQuality ?? outputs.quality!;

  const saved = await prisma.script.create({
    data: {
      organizationId,
      userId,
      title: finalScript.title,
      format: request.contentType,
      prompt: request.prompt,
      body: composeScriptBody(finalScript),
      status: 'DRAFT',
      pipelineStatus: 'COMPLETE',
      qualityScore: finalQuality.qualityScore,
      agentOutputs: outputs as never,
    },
  });

  yield { kind: 'pipeline_done', scriptId: saved.id, outputs };
}

async function* fail(
  error: unknown,
  agent: keyof AgentOutputs,
  stage: PipelineStage
): AsyncGenerator<PipelineEvent> {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Agent ${String(agent)} failed: ${message}`);
  yield { kind: 'agent_error', agent, stage, error: message };
  yield { kind: 'pipeline_error', error: message };
}

function pickFinal(outputs: AgentOutputs): ScriptDraft {
  if (
    outputs.revisedScript &&
    outputs.revisedQuality &&
    outputs.quality &&
    outputs.revisedQuality.qualityScore >= outputs.quality.qualityScore
  ) {
    return outputs.revisedScript;
  }
  return outputs.script!;
}

async function loadCreatorProfile(organizationId: string): Promise<CreatorProfile> {
  const influencer = await prisma.influencer.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
  });
  const recent = await prisma.scheduledPost.findMany({
    where: { organizationId, status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 5,
  });
  return {
    handle: influencer?.handle ?? '@ariavance',
    platform: influencer?.platform ?? 'instagram',
    followers: influencer?.followers ?? 128_420,
    engagement: influencer?.engagement ?? 5.8,
    bio: influencer?.notes ?? null,
    niche: NICHE_FALLBACK,
    topPosts: recent.map((p) => ({ caption: p.caption })),
    bestPostingTimes: ['Tue 6:30 PM IST', 'Thu 7:00 PM IST'],
  };
}

async function loadCompetitors(organizationId: string): Promise<CompetitorBrief[]> {
  const rows = await prisma.competitor.findMany({ where: { organizationId }, take: 8 });
  return rows.map((c) => ({
    handle: c.handle,
    platform: c.platform,
    followers: c.followers,
    engagement: c.engagement,
    growth30d: c.growth30d,
    notes: c.notes,
  }));
}

function composeScriptBody(s: ScriptDraft): string {
  return [
    `Hook: ${s.hook}`,
    '',
    `Body:\n${s.body}`,
    '',
    `CTA: ${s.cta}`,
    '',
    `Caption: ${s.caption}`,
    '',
    `Hashtags: ${s.hashtags.join(' ')}`,
    '',
    `Filming notes: ${s.filmingNotes}`,
    `Estimated duration: ${s.estimatedDuration}`,
  ].join('\n');
}
