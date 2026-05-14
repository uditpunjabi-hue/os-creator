import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

const STAGES = ['IDEA', 'FILMING', 'EDITING', 'READY', 'SCHEDULED', 'PUBLISHED'] as const;
type Stage = (typeof STAGES)[number];

interface PatchBody {
  film?: boolean;
  edit?: boolean;
  captions?: boolean;
  finalReview?: boolean;
  status?: Stage;
}

/**
 * Persist checklist toggles + stage transitions. Auto-stamps filmedAt /
 * editedAt / readyAt so progress survives a reload (matches the NestJS
 * controller).
 */
export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;

    const existing = await prisma.contentPiece.findFirst({
      where: { id, organizationId: org.id },
    });
    if (!existing) return errorResponse(404, 'ContentPiece not found');

    if (body.status !== undefined && !STAGES.includes(body.status)) {
      return errorResponse(400, `Invalid status: ${body.status}`);
    }

    const current = (existing.checklist as Record<string, boolean> | null) ?? {};
    const next: Record<string, boolean> = {
      film: current.film ?? false,
      edit: current.edit ?? false,
      captions: current.captions ?? false,
      finalReview: current.finalReview ?? false,
    };
    for (const key of ['film', 'edit', 'captions', 'finalReview'] as const) {
      if (body[key] !== undefined) next[key] = body[key]!;
    }

    const now = new Date();
    const data: Record<string, unknown> = { checklist: next };
    if (body.film === true && !existing.filmedAt) data.filmedAt = now;
    if (body.edit === true && !existing.editedAt) data.editedAt = now;
    if (
      next.film &&
      next.edit &&
      next.captions &&
      next.finalReview &&
      !existing.readyAt
    ) {
      data.readyAt = now;
    }
    if (body.status) data.status = body.status;

    const updated = await prisma.contentPiece.update({
      where: { id },
      data,
      include: { script: { select: { id: true, title: true } } },
    });
    return NextResponse.json(updated);
  }
);
