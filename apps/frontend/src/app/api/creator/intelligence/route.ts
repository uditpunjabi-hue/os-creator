import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { getProfileIntelligence } from '@gitroom/frontend/lib/server/agents/profile-intelligence.agent';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';
// Full analysis can run ~20-40s on a cold cache (Claude + IG aggregation).
export const maxDuration = 60;

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const force = req.nextUrl.searchParams.get('refresh') === '1';
  const intel = await getProfileIntelligence(org.id, force);
  return NextResponse.json(intel);
});
