import { NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

/**
 * Full script payload for the detail view — includes the raw agentOutputs
 * blob (profile/competitor/trends/strategy/script/quality + revisions) so the
 * page can render the agent analysis summary without a second fetch.
 *
 * Also returns the linked ContentPiece id (if any) so the "Move to Create"
 * button can either deep-link to the existing piece or call /approve to
 * spawn one.
 */
export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const script = await prisma.script.findFirst({
      where: { id, organizationId: org.id },
      include: {
        contentPieces: { select: { id: true, status: true }, take: 1 },
      },
    });
    if (!script) return errorResponse(404, 'Script not found');
    return NextResponse.json({
      id: script.id,
      title: script.title,
      format: script.format,
      prompt: script.prompt,
      body: script.body,
      feedback: script.feedback,
      status: script.status,
      pipelineStatus: script.pipelineStatus,
      qualityScore: script.qualityScore,
      agentOutputs: script.agentOutputs,
      revisions: script.revisions,
      scheduledAt: script.scheduledAt,
      publishedAt: script.publishedAt,
      createdAt: script.createdAt,
      updatedAt: script.updatedAt,
      contentPieceId: script.contentPieces[0]?.id ?? null,
    });
  }
);
