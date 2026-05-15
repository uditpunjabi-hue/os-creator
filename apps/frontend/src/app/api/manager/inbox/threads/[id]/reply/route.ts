import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { replyGmail } from '@gitroom/frontend/lib/server/gmail';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

interface ReplyBody {
  body?: string;
  template?: string;
}

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { user } = await getAuth();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as ReplyBody;
    if (!body.body || !body.body.trim()) return errorResponse(400, 'body required');
    const t = await replyGmail(user.id, id, { body: body.body, template: body.template });
    if (!t) return errorResponse(404, 'Thread not found');
    return NextResponse.json(t);
  }
);
