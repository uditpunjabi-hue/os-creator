import { NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

export const DELETE = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { user, org } = await getAuth();
    const { id } = await ctx.params;
    const existing = await prisma.hashtagSet.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id || existing.organizationId !== org.id) {
      return errorResponse(404, 'set not found');
    }
    await prisma.hashtagSet.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
