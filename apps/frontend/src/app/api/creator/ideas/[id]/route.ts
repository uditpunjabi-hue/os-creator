import { NextRequest, NextResponse } from 'next/server';
import type { ContentIdeaStatus } from '@prisma/client';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { setIdeaStatus } from '@gitroom/frontend/lib/server/ideas-generator';

export const runtime = 'nodejs';

const ALLOWED: ContentIdeaStatus[] = ['NEW', 'SAVED', 'DISMISSED', 'USED'];

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { user } = await getAuth();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { status?: ContentIdeaStatus };
    if (!body.status || !ALLOWED.includes(body.status)) {
      return errorResponse(400, `status must be one of ${ALLOWED.join(', ')}`);
    }
    const updated = await setIdeaStatus(user.id, id, body.status);
    if (!updated) return errorResponse(404, 'idea not found');
    return NextResponse.json(updated);
  }
);
