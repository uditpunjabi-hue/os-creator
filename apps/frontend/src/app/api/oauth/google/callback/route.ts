import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { ensureDemoUser } from '@gitroom/frontend/lib/server/auth';
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

    const demoUser = await ensureDemoUser();
    await prisma.user.update({
      where: { id: demoUser.id },
      data: {
        googleAccessToken: tokens.access_token,
        ...(tokens.refresh_token ? { googleRefreshToken: tokens.refresh_token } : {}),
        googleExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        googleEmail: email,
        googleConnectedAt: new Date(),
      },
    });

    const res = NextResponse.redirect(
      frontendUrl('/onboarding/connecting?provider=google&status=success', req)
    );
    await signInUser(res, demoUser.id);
    return res;
  } catch (e) {
    console.error('[google callback] crashed', e);
    return NextResponse.redirect(frontendUrl('/auth/login?error=google_callback', req));
  }
}
