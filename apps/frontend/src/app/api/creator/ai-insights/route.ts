import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { getAiInsights } from '@gitroom/frontend/lib/server/instagram-ai-insights';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';
// Claude call can take ~10–20s; well under Vercel Pro's 300s.
export const maxDuration = 60;

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const force = req.nextUrl.searchParams.get('refresh') === '1';
  const insights = await getAiInsights(org.id, force);
  return NextResponse.json(insights);
});
