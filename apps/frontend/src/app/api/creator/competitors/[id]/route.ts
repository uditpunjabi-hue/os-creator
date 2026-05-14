import { NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

export const DELETE = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    await prisma.competitor.deleteMany({ where: { id, organizationId: org.id } });
    return NextResponse.json({ ok: true });
  }
);
