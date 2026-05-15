import { NextRequest, NextResponse } from 'next/server';
import { backendBase } from '@gitroom/frontend/lib/server/cookie';
import { errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.readonly',
];

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return errorResponse(503, 'GOOGLE_CLIENT_ID not configured');

  let base: string;
  try {
    base = backendBase(req);
  } catch (e) {
    return errorResponse(500, (e as Error).message);
  }
  const redirectUri = `${base}/api/oauth/google/callback`;

  if (req.nextUrl.searchParams.get('diag') === '1') {
    return NextResponse.json({
      clientId: `${clientId.slice(0, 6)}…`,
      redirectUri,
      scopes: GOOGLE_SCOPES,
      nodeEnv: process.env.NODE_ENV ?? null,
      hasFrontendUrl: !!process.env.FRONTEND_URL,
      hasOauthRedirectBase: !!process.env.OAUTH_REDIRECT_BASE,
    });
  }

  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  return NextResponse.redirect(url.toString(), 302);
}
