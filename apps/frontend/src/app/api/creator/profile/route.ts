import { NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { getInstagramProfile } from '@gitroom/frontend/lib/server/instagram';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async () => {
  const { org } = await getAuth();
  const profile = await getInstagramProfile(org.id);
  return NextResponse.json(profile);
});
