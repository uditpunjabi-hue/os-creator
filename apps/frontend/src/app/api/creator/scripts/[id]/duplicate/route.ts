import { NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

/**
 * Clone an existing script into a new DRAFT — used by "Duplicate & Edit" on
 * the detail page when the creator wants to riff on a variation without
 * re-running the 6-agent pipeline.
 *
 * Copies title (with " (copy)" suffix), prompt, body, format, qualityScore,
 * and the full agentOutputs blob so the duplicate carries the same analysis
 * context. Status is reset to DRAFT regardless of the source status.
 */
export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { user, org } = await getAuth();
    const { id } = await ctx.params;
    const source = await prisma.script.findFirst({
      where: { id, organizationId: org.id },
    });
    if (!source) return errorResponse(404, 'Script not found');

    const copy = await prisma.script.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        title: `${source.title} (copy)`,
        format: source.format,
        prompt: source.prompt,
        body: source.body,
        status: 'DRAFT',
        pipelineStatus: source.pipelineStatus,
        qualityScore: source.qualityScore,
        // Prisma's Json input type rejects JsonValue|null without a cast; the
        // orchestrator uses the same pattern when writing agentOutputs.
        agentOutputs: source.agentOutputs as never,
        revisions: source.revisions as never,
      },
    });
    return NextResponse.json({ id: copy.id });
  }
);
