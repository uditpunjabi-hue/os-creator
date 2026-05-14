import { NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { getInstagramInsights } from '@gitroom/frontend/lib/server/instagram-insights';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async () => {
  const { org } = await getAuth();
  const insights = await getInstagramInsights(org.id);
  return NextResponse.json(insights);
});
