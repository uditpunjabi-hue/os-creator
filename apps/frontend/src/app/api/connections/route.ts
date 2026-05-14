import { NextResponse } from 'next/server';
import { getCurrentUser } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

/**
 * Returns the user's OAuth connection state. Mirrors what the NestJS
 * ConnectionsController returned so the frontend's existing /connections
 * fetch keeps working with no shape change.
 */
export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  return NextResponse.json({
    instagram: {
      connected: Boolean(user.instagramAccessToken),
      handle: user.instagramHandle,
      connectedAt: user.instagramConnectedAt,
      followers: user.instagramFollowers,
    },
    google: {
      connected: Boolean(user.googleAccessToken),
      email: user.googleEmail,
      connectedAt: user.googleConnectedAt,
    },
  });
});
