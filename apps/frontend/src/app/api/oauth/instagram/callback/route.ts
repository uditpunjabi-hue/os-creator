import { NextRequest, NextResponse } from 'next/server';
import {
  readCurrentUserIdSilent,
  signInWithInstagram,
} from '@gitroom/frontend/lib/server/auth';
import { signInUser, frontendUrl, backendBase } from '@gitroom/frontend/lib/server/cookie';

export const runtime = 'nodejs';

const FB_TOKEN = 'https://graph.facebook.com/v18.0/oauth/access_token';
const FB_GRAPH = 'https://graph.facebook.com/v18.0';

interface Page {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  const errorReason = req.nextUrl.searchParams.get('error_reason');
  const errorDescription = req.nextUrl.searchParams.get('error_description');

  if (error || !code) {
    const reason = errorDescription ?? errorReason ?? error ?? 'no_code';
    return NextResponse.redirect(
      frontendUrl(`/auth/login?error=${encodeURIComponent(reason)}`, req)
    );
  }

  try {
    // step 1: short-lived user token
    const tokenUrl = new URL(FB_TOKEN);
    tokenUrl.searchParams.set('client_id', process.env.META_APP_ID!);
    tokenUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!);
    // Must match the redirect_uri sent to /start exactly.
    tokenUrl.searchParams.set('redirect_uri', `${backendBase(req)}/api/oauth/instagram/callback`);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenBody = await tokenRes.text();
    if (!tokenRes.ok) {
      return NextResponse.redirect(
        frontendUrl(
          `/auth/login?error=meta_token_exchange&detail=${encodeURIComponent(tokenBody.slice(0, 200))}`,
          req
        )
      );
    }
    const short = JSON.parse(tokenBody) as { access_token: string; expires_in?: number };

    // step 2: long-lived (60d) token
    const longUrl = new URL(FB_TOKEN);
    longUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longUrl.searchParams.set('client_id', process.env.META_APP_ID!);
    longUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!);
    longUrl.searchParams.set('fb_exchange_token', short.access_token);
    const longRes = await fetch(longUrl.toString());
    const longBody = await longRes.text();
    const long = longRes.ok ? (JSON.parse(longBody) as { access_token: string }) : null;
    const fbToken = long?.access_token ?? short.access_token;

    // step 3b: direct admin Pages
    const pagesRes = await fetch(
      `${FB_GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(fbToken)}`
    );
    const pagesPayload = (await pagesRes.json().catch(() => ({}))) as {
      data?: Page[];
      error?: { message: string };
    };
    const directPages: Page[] = pagesPayload.data ?? [];

    // step 3c: BM-owned Pages — best-effort. `business_management` was
    // dropped from the OAuth scopes (see start/route.ts) so /me/businesses
    // will normally return an error/empty here. We still try because:
    //   (a) admins of the FB app itself can call it without the scope, and
    //   (b) if business_management is later re-added to scopes, this code
    //       starts working without any other change.
    const bmPages: Page[] = [];
    try {
      const bizRes = await fetch(
        `${FB_GRAPH}/me/businesses?fields=id,name&access_token=${encodeURIComponent(fbToken)}`
      );
      const biz = (await bizRes.json().catch(() => ({}))) as {
        data?: Array<{ id: string; name: string }>;
      };
      for (const b of biz.data ?? []) {
        for (const edge of ['owned_pages', 'client_pages'] as const) {
          const r = await fetch(
            `${FB_GRAPH}/${b.id}/${edge}?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(fbToken)}`
          );
          if (!r.ok) continue;
          const parsed = (await r.json().catch(() => ({}))) as { data?: Page[] };
          for (const p of parsed.data ?? []) {
            if (!bmPages.some((x) => x.id === p.id)) bmPages.push(p);
          }
        }
      }
    } catch (e) {
      console.warn(`[IG callback] BM page discovery soft-failed: ${(e as Error).message}`);
    }

    const allPages: Page[] = [...directPages, ...bmPages];
    const pageWithIg = allPages.find((p) => p.instagram_business_account) ?? null;

    // step 4: hydrate IG profile
    let igProfile: {
      id: string;
      username?: string;
      followers_count?: number;
      media_count?: number;
      biography?: string;
      profile_picture_url?: string;
    } | null = null;
    if (pageWithIg?.instagram_business_account) {
      const igId = pageWithIg.instagram_business_account.id;
      const fields = 'id,username,followers_count,media_count,biography,profile_picture_url';
      const igRes = await fetch(
        `${FB_GRAPH}/${igId}?fields=${fields}&access_token=${encodeURIComponent(pageWithIg.access_token)}`
      );
      if (igRes.ok) igProfile = (await igRes.json()) as typeof igProfile;
    }

    // Store Page token (not user token) — required for IG Graph API calls.
    // Page tokens issued from a long-lived user token are themselves long-lived.
    const tokenForIgCalls = pageWithIg?.access_token ?? fbToken;
    const fullyConnected = !!igProfile;

    if (!fullyConnected || !igProfile) {
      return NextResponse.redirect(
        frontendUrl(
          '/auth/login?error=no_ig_business&detail=' +
            encodeURIComponent(
              'Facebook returned 0 Pages. Link an IG Business/Creator account to a Facebook Page at business.facebook.com → Accounts → Instagram, then click Connect again.'
            ),
          req
        )
      );
    }

    // Attach to existing session if the user is already signed in (e.g.
    // they hit "Connect Instagram" from Settings). For first-time visitors
    // hitting /auth/login this is null and we fall through to create.
    const currentUserId = await readCurrentUserIdSilent();
    const { user, isNewUser } = await signInWithInstagram(
      {
        instagramUserId: igProfile.id,
        instagramHandle: igProfile.username ? `@${igProfile.username}` : null,
        followers: igProfile.followers_count ?? null,
        mediaCount: igProfile.media_count ?? null,
        bio: igProfile.biography ?? null,
        profilePic: igProfile.profile_picture_url ?? null,
        accessToken: tokenForIgCalls,
      },
      currentUserId
    );

    // Land new users on the onboarding screen (it shows "Welcome @handle…"
    // and runs the intelligence agent in the background); returning users
    // skip straight to the dashboard.
    const target = isNewUser
      ? '/onboarding/connecting?provider=instagram&status=success&new=1'
      : '/onboarding/connecting?provider=instagram&status=success';
    const res = NextResponse.redirect(frontendUrl(target, req));
    await signInUser(res, user.id);
    return res;
  } catch (e) {
    const err = e as Error;
    console.error(`[IG callback] CRASH: ${err.message}\n${err.stack ?? '(no stack)'}`);
    return NextResponse.redirect(
      frontendUrl(
        `/auth/login?error=instagram_callback&detail=${encodeURIComponent(err.message.slice(0, 200))}`,
        req
      )
    );
  }
}
