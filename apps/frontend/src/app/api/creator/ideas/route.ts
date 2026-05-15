import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';
import { getIdeasForUser, regenerateIdeas } from '@gitroom/frontend/lib/server/ideas-generator';

export const runtime = 'nodejs';
// Regeneration can call Claude for ~20s; give the function headroom.
export const maxDuration = 60;

export const GET = withErrorHandling(async () => {
  const { user, org } = await getAuth();
  const snap = await getIdeasForUser(user.id, org.id);
  return NextResponse.json(snap);
});

export const POST = withErrorHandling(async (_req: NextRequest) => {
  const { user, org } = await getAuth();
  await regenerateIdeas(user.id, org.id, true);
  const snap = await getIdeasForUser(user.id, org.id);
  return NextResponse.json(snap);
});
