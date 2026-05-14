import { NextRequest, NextResponse } from 'next/server';
import { Prisma, DealStage } from '@prisma/client';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { decimalRecord } from '@gitroom/frontend/lib/server/decimal';

export const runtime = 'nodejs';

interface UpdateBody {
  brand?: string;
  influencerId?: string;
  offer?: number | string;
  floor?: number | string | null;
  ceiling?: number | string | null;
  stage?: DealStage;
  notes?: string | null;
}

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const row = await prisma.deal.findFirst({
      where: { id, organizationId: org.id },
      include: { influencer: true, contracts: true, commercials: true },
    });
    if (!row) return errorResponse(404, 'Deal not found');
    return NextResponse.json(decimalRecord(row));
  }
);

export const PUT = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as UpdateBody;
    const row = await prisma.deal.update({
      where: { id, organizationId: org.id },
      data: {
        ...(body.brand !== undefined && { brand: body.brand }),
        ...(body.influencerId !== undefined && { influencerId: body.influencerId }),
        ...(body.offer !== undefined && { offer: new Prisma.Decimal(body.offer) }),
        ...(body.floor !== undefined && {
          floor: body.floor == null ? null : new Prisma.Decimal(body.floor),
        }),
        ...(body.ceiling !== undefined && {
          ceiling: body.ceiling == null ? null : new Prisma.Decimal(body.ceiling),
        }),
        ...(body.stage !== undefined && { stage: body.stage }),
        ...(body.notes !== undefined && { notes: body.notes ?? undefined }),
      },
      include: { influencer: { select: { id: true, name: true, handle: true } } },
    });
    return NextResponse.json(decimalRecord(row));
  }
);

export const DELETE = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    await prisma.deal.delete({ where: { id, organizationId: org.id } });
    return NextResponse.json({ ok: true });
  }
);
