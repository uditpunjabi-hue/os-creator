import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { setGmailStarred } from '@gitroom/frontend/lib/server/gmail';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { user } = await getAuth();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { starred?: boolean };
    if (typeof body.starred !== 'boolean') return errorResponse(400, 'starred boolean required');
    const t = await setGmailStarred(user.id, id, body.starred);
    if (!t) return errorResponse(404, 'Thread not found');
    return NextResponse.json(t);
  }
);
