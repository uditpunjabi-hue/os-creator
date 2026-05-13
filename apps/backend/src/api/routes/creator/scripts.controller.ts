import {
  Body,
  Controller,
  Get,
  HttpException,
  Logger,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Organization, User } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { PipelineOrchestrator } from '@gitroom/backend/agents/pipeline.orchestrator';
import type {
  AgentOutputs,
  PipelineRequest,
  ScriptDraft,
} from '@gitroom/backend/agents/types';

@ApiTags('Creator')
@Controller('/creator/scripts')
export class CreatorScriptsController {
  private readonly logger = new Logger(CreatorScriptsController.name);

  constructor(
    private orchestrator: PipelineOrchestrator,
    private prisma: PrismaService
  ) {}

  /** Returns every Script row for the org, newest first. */
  @Get('/')
  async list(@GetOrgFromRequest() org: Organization) {
    return this.prisma.script.findMany({
      where: { organizationId: org.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        format: true,
        prompt: true,
        body: true,
        feedback: true,
        status: true,
        pipelineStatus: true,
        qualityScore: true,
        scheduledAt: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Streams NDJSON events from the 6-agent pipeline. One JSON object per line.
   * Event kinds: pipeline_start | agent_start | agent_done | agent_error |
   * pipeline_done | pipeline_error. See @gitroom/backend/agents/types.
   */
  @Post('/generate')
  async generate(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: PipelineRequest,
    @Res() res: Response
  ) {
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(503).json({
        error: 'ANTHROPIC_API_KEY_NOT_CONFIGURED',
        message:
          'AI script generation is not configured. Set ANTHROPIC_API_KEY in .env and restart the backend.',
      });
      return;
    }

    const prompt = (body?.prompt ?? '').trim();
    if (!prompt) {
      throw new HttpException('prompt is required', 400);
    }
    const contentType = body?.contentType ?? 'reel';
    const tone = body?.tone ?? 'educational';

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    // Hint Express to not buffer.
    res.flushHeaders?.();

    try {
      for await (const event of this.orchestrator.run(org.id, user.id, {
        prompt,
        contentType,
        tone,
      })) {
        res.write(JSON.stringify(event) + '\n');
        // Force flush each event so the frontend sees real-time progress.
        (res as any).flush?.();
      }
    } catch (e) {
      this.logger.error('Pipeline crashed', e as Error);
      res.write(
        JSON.stringify({
          kind: 'pipeline_error',
          error: (e as Error).message,
        }) + '\n'
      );
    } finally {
      res.end();
    }
  }

  /**
   * Approve a generated script: flip it to APPROVED and spawn a ContentPiece
   * that drops into the filming workflow on /creator/content/new. Idempotent —
   * if the script already has a ContentPiece, returns the existing one rather
   * than duplicating.
   *
   * ContentPiece status is FILMING (the closest enum value to "in production";
   * ContentPieceStatus is IDEA | FILMING | EDITING | READY | SCHEDULED |
   * PUBLISHED — no IN_PRODUCTION).
   */
  @Post('/:id/approve')
  async approve(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    const script = await this.prisma.script.findFirst({
      where: { id, organizationId: org.id },
    });
    if (!script) throw new HttpException('Script not found', 404);

    const outputs = (script.agentOutputs ?? {}) as AgentOutputs;
    const draft: ScriptDraft | undefined = outputs.revisedScript ?? outputs.script;

    const existing = await this.prisma.contentPiece.findFirst({
      where: { scriptId: script.id, organizationId: org.id },
    });

    return this.prisma.$transaction(async (tx) => {
      const updatedScript = await tx.script.update({
        where: { id: script.id },
        data: { status: 'APPROVED' },
      });

      const piece =
        existing ??
        (await tx.contentPiece.create({
          data: {
            organizationId: org.id,
            scriptId: script.id,
            title: script.title,
            format: script.format,
            status: 'FILMING',
            hook: draft?.hook ?? null,
            body: draft?.body ?? script.body,
            cta: draft?.cta ?? null,
            caption: draft?.caption ?? null,
            hashtags: draft?.hashtags ?? [],
            checklist: {
              film: false,
              edit: false,
              captions: false,
              finalReview: false,
            },
            approvedAt: new Date(),
          },
        }));

      return { script: updatedScript, piece };
    });
  }
}
