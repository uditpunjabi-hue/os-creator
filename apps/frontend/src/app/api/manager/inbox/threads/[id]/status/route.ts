import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { setGmailStatus, type ThreadStatus } from '@gitroom/frontend/lib/server/gmail';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

const STATUSES: ThreadStatus[] = [
  'NEW_LEAD',
  'IN_NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
  'REJECTED',
];

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { user } = await getAuth();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { status?: ThreadStatus };
    if (!body.status || !STATUSES.includes(body.status)) {
      return errorResponse(400, `status must be one of ${STATUSES.join(', ')}`);
    }
    const t = await setGmailStatus(user.id, id, body.status);
    if (!t) return errorResponse(404, 'Thread not found');
    return NextResponse.json(t);
  }
);
