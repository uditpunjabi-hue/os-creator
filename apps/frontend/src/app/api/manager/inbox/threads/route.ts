import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { listGmailThreads } from '@gitroom/frontend/lib/server/gmail';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const q = req.nextUrl.searchParams.get('q') ?? undefined;
  const threads = await listGmailThreads(org.id, q);
  return NextResponse.json(threads);
});
