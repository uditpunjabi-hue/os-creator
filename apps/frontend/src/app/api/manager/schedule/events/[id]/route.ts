import { NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { deleteCalendarEvent } from '@gitroom/frontend/lib/server/google-calendar';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

export const DELETE = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const result = await deleteCalendarEvent(org.id, id);
    return NextResponse.json(result);
  }
);
