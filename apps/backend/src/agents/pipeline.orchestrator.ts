import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { runProfileAnalyst } from './profile-analyst.agent';
import { runCompetitorScout } from './competitor-scout.agent';
import { runTrendDetector } from './trend-detector.agent';
import { runStrategyArchitect } from './strategy-architect.agent';
import { runScriptWriter } from './script-writer.agent';
import { runQualityReviewer } from './quality-reviewer.agent';
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

@Injectable()
export class PipelineOrchestrator {
  private readonly logger = new Logger(PipelineOrchestrator.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Async generator that drives the 6-agent pipeline, yielding NDJSON-friendly
   * events. The caller is responsible for serializing each event to the wire.
   *
   * On success, the final `pipeline_done` event includes the persisted Script
   * id (in DB with all agent outputs) and the full outputs map.
   *
   * On agent failure, yields `pipeline_error` and stops. The caller should
   * close the stream.
   */
  async *run(
    organizationId: string,
    userId: string,
    request: PipelineRequest
  ): AsyncGenerator<PipelineEvent> {
    yield {
      kind: 'pipeline_start',
      stages: ['ANALYZING', 'SCOUTING', 'TRENDING', 'STRATEGIZING', 'WRITING', 'REVIEWING'],
    };

    const outputs: AgentOutputs = {};

    const creatorProfile = await this.loadCreatorProfile(organizationId);
    const competitors = await this.loadCompetitors(organizationId);

    // Stage 1: Profile Analyst
    try {
      yield { kind: 'agent_start', agent: 'profile', stage: 'ANALYZING' };
      outputs.profile = await runProfileAnalyst(creatorProfile);
      yield { kind: 'agent_done', agent: 'profile', stage: 'ANALYZING', output: outputs.profile };
    } catch (e) {
      return yield* this.fail(e, 'profile', 'ANALYZING');
    }

    // Stage 2: Competitor Scout
    try {
      yield { kind: 'agent_start', agent: 'competitor', stage: 'SCOUTING' };
      outputs.competitor = await runCompetitorScout(competitors, outputs.profile!);
      yield { kind: 'agent_done', agent: 'competitor', stage: 'SCOUTING', output: outputs.competitor };
    } catch (e) {
      return yield* this.fail(e, 'competitor', 'SCOUTING');
    }

    // Stage 3: Trend Detector
    try {
      yield { kind: 'agent_start', agent: 'trends', stage: 'TRENDING' };
      const today = new Date().toISOString().slice(0, 10);
      outputs.trends = await runTrendDetector(creatorProfile.niche, today, outputs.profile!);
      yield { kind: 'agent_done', agent: 'trends', stage: 'TRENDING', output: outputs.trends };
    } catch (e) {
      return yield* this.fail(e, 'trends', 'TRENDING');
    }

    // Stage 4: Strategy Architect
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
      return yield* this.fail(e, 'strategy', 'STRATEGIZING');
    }

    // Stage 5: Script Writer
    try {
      yield { kind: 'agent_start', agent: 'script', stage: 'WRITING' };
      outputs.script = await runScriptWriter(outputs.strategy!, request.prompt);
      yield { kind: 'agent_done', agent: 'script', stage: 'WRITING', output: outputs.script };
    } catch (e) {
      return yield* this.fail(e, 'script', 'WRITING');
    }

    // Stage 6: Quality Reviewer
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
      return yield* this.fail(e, 'quality', 'REVIEWING');
    }

    // Auto-revise once if quality score is below the threshold.
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
        this.logger.warn(`Auto-revise failed: ${(e as Error).message}`);
      }
    }

    // Pick the best script we've got (revised takes precedence if it scored higher).
    const finalScript = this.pickFinal(outputs);
    const finalQuality = outputs.revisedQuality ?? outputs.quality!;

    const saved = await this.prisma.script.create({
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
        agentOutputs: outputs as any,
      },
    });

    yield { kind: 'pipeline_done', scriptId: saved.id, outputs };
  }

  private async *fail(
    error: unknown,
    agent: keyof AgentOutputs,
    stage: PipelineStage
  ): AsyncGenerator<PipelineEvent> {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Agent ${String(agent)} failed: ${message}`);
    yield { kind: 'agent_error', agent, stage, error: message };
    yield { kind: 'pipeline_error', error: message };
  }

  private pickFinal(outputs: AgentOutputs): ScriptDraft {
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

  private async loadCreatorProfile(organizationId: string): Promise<CreatorProfile> {
    const influencer = await this.prisma.influencer.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
    const recent = await this.prisma.scheduledPost.findMany({
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

  private async loadCompetitors(organizationId: string): Promise<CompetitorBrief[]> {
    const rows = await this.prisma.competitor.findMany({
      where: { organizationId },
      take: 8,
    });
    return rows.map((c) => ({
      handle: c.handle,
      platform: c.platform,
      followers: c.followers,
      engagement: c.engagement,
      growth30d: c.growth30d,
      notes: c.notes,
    }));
  }
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
