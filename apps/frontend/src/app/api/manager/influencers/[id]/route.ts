import { NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { decimalRecord } from '@gitroom/frontend/lib/server/decimal';

export const runtime = 'nodejs';

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const row = await prisma.influencer.findFirst({
      where: { id, organizationId: org.id },
      include: {
        deals: { orderBy: { updatedAt: 'desc' } },
        commercials: { orderBy: { dueAt: 'asc' } },
      },
    });
    if (!row) return errorResponse(404, 'Influencer not found');
    return NextResponse.json({
      ...row,
      deals: row.deals.map(decimalRecord),
      commercials: row.commercials.map(decimalRecord),
    });
  }
);

export const DELETE = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    await prisma.influencer.delete({ where: { id, organizationId: org.id } });
    return NextResponse.json({ ok: true });
  }
);
