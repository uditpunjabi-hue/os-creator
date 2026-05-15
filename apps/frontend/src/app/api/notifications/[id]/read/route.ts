import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { markRead } from '@gitroom/frontend/lib/server/notifications';

export const runtime = 'nodejs';

export const POST = withErrorHandling(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { user } = await getAuth();
    const { id } = await ctx.params;
    const ok = await markRead(user.id, id);
    if (!ok) return errorResponse(404, 'notification not found');
    return NextResponse.json({ ok: true });
  }
);
