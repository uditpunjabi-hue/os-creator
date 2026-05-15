import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { listGmailThreads } from '@gitroom/frontend/lib/server/gmail';
import { getValidGoogleAccessToken } from '@gitroom/frontend/lib/server/google-token';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

// The Inbox page expects an EmailThread[] today. We keep that shape on the
// happy path so existing SWR consumers don't break, and short-circuit to a
// {status, threads:[]} envelope ONLY when something went wrong on the
// Google-token side. The UI checks for `.status` to decide between "empty
// inbox" and "needs reconnect."
export const GET = withErrorHandling(async (req: NextRequest) => {
  const { user } = await getAuth();
  const q = req.nextUrl.searchParams.get('q') ?? undefined;

  // Check token state before going through listGmailThreads (which silently
  // returns [] on any failure — fine for the rest of the app but unhelpful
  // here where we need to surface the failure mode).
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { googleAccessToken: true, googleConnectedAt: true },
  });
  if (!row?.googleAccessToken) {
    return NextResponse.json({ status: 'not_connected', threads: [] });
  }
  const live = await getValidGoogleAccessToken(user.id);
  if (!live) {
    // The token existed but couldn't be refreshed — typically because the
    // user revoked it from Google's security panel, or the refresh token
    // expired. Either way the fix is reconnect.
    return NextResponse.json({ status: 'token_invalid', threads: [] });
  }

  const threads = await listGmailThreads(user.id, q);
  return NextResponse.json({ status: 'ok', threads });
});
