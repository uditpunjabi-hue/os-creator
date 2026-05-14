import { NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { getGmailThread } from '@gitroom/frontend/lib/server/gmail';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const thread = await getGmailThread(org.id, id);
    if (!thread) return errorResponse(404, 'Thread not found');
    return NextResponse.json(thread);
  }
);
