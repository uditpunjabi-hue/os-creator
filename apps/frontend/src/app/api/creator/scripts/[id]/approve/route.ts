import { NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

interface ScriptDraft {
  title?: string;
  hook?: string;
  body?: string;
  cta?: string;
  caption?: string;
  hashtags?: string[];
}

/**
 * Approve a generated script: flip it to APPROVED and spawn a ContentPiece
 * that drops into the filming workflow. Idempotent — re-approving returns
 * the existing piece rather than duplicating.
 */
export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;

    const script = await prisma.script.findFirst({
      where: { id, organizationId: org.id },
    });
    if (!script) return errorResponse(404, 'Script not found');

    const outputs = (script.agentOutputs ?? {}) as Record<string, ScriptDraft | undefined>;
    const draft = outputs.revisedScript ?? outputs.script;

    const existingPiece = await prisma.contentPiece.findFirst({
      where: { scriptId: script.id, organizationId: org.id },
    });

    return NextResponse.json(
      await prisma.$transaction(async (tx) => {
        const updatedScript = await tx.script.update({
          where: { id: script.id },
          data: { status: 'APPROVED' },
        });

        const piece =
          existingPiece ??
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
              checklist: { film: false, edit: false, captions: false, finalReview: false },
              approvedAt: new Date(),
            },
          }));

        return { script: updatedScript, piece };
      })
    );
  }
);
