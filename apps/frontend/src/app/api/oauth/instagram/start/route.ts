import { NextRequest, NextResponse } from 'next/server';
import { backendBase } from '@gitroom/frontend/lib/server/cookie';
import { errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

const FB_AUTH = 'https://www.facebook.com/v18.0/dialog/oauth';
const META_SCOPES = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
  // business_management is required to enumerate Pages owned by a Business
  // Manager via /me/businesses/{id}/owned_pages — without it, BM-owned
  // Pages do NOT appear in /me/accounts even when the user is an admin.
  'business_management',
];

export async function GET(req: NextRequest) {
  const clientId = process.env.META_APP_ID;
  if (!clientId) return errorResponse(503, 'META_APP_ID not configured');

  let base: string;
  try {
    base = backendBase(req);
  } catch (e) {
    return errorResponse(500, (e as Error).message);
  }
  const redirectUri = `${base}/api/oauth/instagram/callback`;

  // ?diag=1 — return what we'd send to Facebook as JSON, no redirect. Used
  // for `curl https://os-creator.vercel.app/api/oauth/instagram/start?diag=1`
  // to verify the redirect_uri before debugging in the browser.
  if (req.nextUrl.searchParams.get('diag') === '1') {
    return NextResponse.json({
      clientId: `${clientId.slice(0, 6)}…`,
      redirectUri,
      scopes: META_SCOPES,
      nodeEnv: process.env.NODE_ENV ?? null,
      hasFrontendUrl: !!process.env.FRONTEND_URL,
      hasOauthRedirectBase: !!process.env.OAUTH_REDIRECT_BASE,
    });
  }

  const url = new URL(FB_AUTH);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', META_SCOPES.join(','));
  // Force consent every time so newly-added scopes get explicitly granted
  // without making the user manually remove the app from Business Tools.
  url.searchParams.set('auth_type', 'rerequest');
  return NextResponse.redirect(url.toString(), 302);
}
