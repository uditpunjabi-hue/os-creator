import { NextRequest, NextResponse } from 'next/server';
import {
  readCurrentUserIdSilent,
  signInWithGoogle,
} from '@gitroom/frontend/lib/server/auth';
import { signInUser, frontendUrl, backendBase } from '@gitroom/frontend/lib/server/cookie';

export const runtime = 'nodejs';

const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(
      frontendUrl(`/auth/login?error=${encodeURIComponent(error ?? 'no_code')}`, req)
    );
  }

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        // Must match the redirect_uri sent to /start exactly, including the
        // request-origin fallback when env vars are unset.
        redirect_uri: `${backendBase(req)}/api/oauth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      console.warn(`[google callback] token exchange failed: ${detail.slice(0, 300)}`);
      return NextResponse.redirect(frontendUrl('/auth/login?error=google_token_exchange', req));
    }
    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    let email: string | null = null;
    try {
      const userinfo = await fetch(GOOGLE_USERINFO, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userinfo.ok) {
        const data = (await userinfo.json()) as { email?: string };
        email = data.email ?? null;
      }
    } catch (e) {
      console.warn(`[google callback] userinfo fetch failed: ${(e as Error).message}`);
    }
    if (!email) {
      // Without an email we can't reliably identify the user across sessions.
      // The Google scope set always includes openid+email, so this should
      // never happen in practice — fail loud rather than seeding a ghost row.
      return NextResponse.redirect(
        frontendUrl('/auth/login?error=google_no_email', req)
      );
    }

    // If they're already signed in (e.g. via Instagram), attach Google to
    // that account instead of creating a duplicate user.
    const currentUserId = await readCurrentUserIdSilent();
    const { user, isNewUser } = await signInWithGoogle(
      {
        googleEmail: email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresIn: tokens.expires_in ?? null,
      },
      currentUserId
    );

    const target = isNewUser
      ? '/onboarding/connecting?provider=google&status=success&new=1'
      : '/onboarding/connecting?provider=google&status=success';
    const res = NextResponse.redirect(frontendUrl(target, req));
    await signInUser(res, user.id);
    return res;
  } catch (e) {
    console.error('[google callback] crashed', e);
    return NextResponse.redirect(frontendUrl('/auth/login?error=google_callback', req));
  }
}
