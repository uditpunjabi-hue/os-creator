import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { ensureDemoUser } from '@gitroom/frontend/lib/server/auth';
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
      frontendUrl(`/auth/login?error=${encodeURIComponent(reason)}`)
    );
  }

  try {
    // step 1: short-lived user token
    const tokenUrl = new URL(FB_TOKEN);
    tokenUrl.searchParams.set('client_id', process.env.META_APP_ID!);
    tokenUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!);
    tokenUrl.searchParams.set('redirect_uri', `${backendBase()}/api/oauth/instagram/callback`);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenBody = await tokenRes.text();
    if (!tokenRes.ok) {
      return NextResponse.redirect(
        frontendUrl(
          `/auth/login?error=meta_token_exchange&detail=${encodeURIComponent(tokenBody.slice(0, 200))}`
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

    // step 3c: BM-owned Pages (require business_management scope)
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

    const demoUser = await ensureDemoUser();
    await prisma.user.update({
      where: { id: demoUser.id },
      data: {
        instagramAccessToken: tokenForIgCalls,
        instagramUserId: igProfile?.id ?? pageWithIg?.instagram_business_account?.id ?? null,
        instagramHandle: igProfile?.username ? `@${igProfile.username}` : null,
        instagramFollowers: igProfile?.followers_count ?? null,
        instagramMediaCount: igProfile?.media_count ?? null,
        instagramBio: igProfile?.biography ?? null,
        instagramProfilePic: igProfile?.profile_picture_url ?? null,
        instagramConnectedAt: fullyConnected ? new Date() : null,
      },
    });

    if (fullyConnected) {
      const res = NextResponse.redirect(
        frontendUrl('/onboarding/connecting?provider=instagram&status=success')
      );
      await signInUser(res, demoUser.id);
      return res;
    }
    return NextResponse.redirect(
      frontendUrl(
        '/auth/login?error=no_ig_business&detail=' +
          encodeURIComponent(
            'Facebook returned 0 Pages. Link an IG Business/Creator account to a Facebook Page at business.facebook.com → Accounts → Instagram, then click Connect again.'
          )
      )
    );
  } catch (e) {
    const err = e as Error;
    console.error(`[IG callback] CRASH: ${err.message}\n${err.stack ?? '(no stack)'}`);
    return NextResponse.redirect(
      frontendUrl(
        `/auth/login?error=instagram_callback&detail=${encodeURIComponent(err.message.slice(0, 200))}`
      )
    );
  }
}
