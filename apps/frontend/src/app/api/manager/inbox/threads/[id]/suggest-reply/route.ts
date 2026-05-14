import { NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { suggestReply } from '@gitroom/frontend/lib/server/suggest-reply';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    try {
      const result = await suggestReply(org.id, id);
      return NextResponse.json(result);
    } catch (e) {
      return errorResponse(502, (e as Error).message);
    }
  }
);
