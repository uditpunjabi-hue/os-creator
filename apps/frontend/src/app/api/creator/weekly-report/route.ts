import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { getWeeklyReport } from '@gitroom/frontend/lib/server/instagram-weekly-report';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';
// Claude call can run ~10-20s.
export const maxDuration = 60;

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const force = req.nextUrl.searchParams.get('refresh') === '1';
  const report = await getWeeklyReport(org.id, force);
  return NextResponse.json(report);
});
