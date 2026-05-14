import { NextRequest, NextResponse } from 'next/server';
import { DealStage } from '@prisma/client';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { decimalRecord } from '@gitroom/frontend/lib/server/decimal';

export const runtime = 'nodejs';

const STAGES = Object.values(DealStage);

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { stage?: DealStage };
    if (!body.stage || !STAGES.includes(body.stage)) {
      return errorResponse(400, `stage must be one of ${STAGES.join(', ')}`);
    }
    const row = await prisma.deal.update({
      where: { id, organizationId: org.id },
      data: { stage: body.stage },
      include: { influencer: { select: { id: true, name: true, handle: true } } },
    });
    return NextResponse.json(decimalRecord(row));
  }
);
