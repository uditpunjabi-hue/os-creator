import {
  Controller,
  Get,
  HttpException,
  Logger,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';
import type { User } from '@prisma/client';

interface Page {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

/**
 * OAuth controller for Illuminati's "Connect Google / Instagram" landing flow.
 *
 * Single-tenant demo mode: every successful callback links to the seeded user
 * (opnclaw123@gmail.com / LOCAL). Multi-tenant would encode userId into the
 * OAuth `state` param signed with JWT_SECRET.
 *
 * Routes are public on purpose — Google + Meta hit /callback without an auth
 * cookie. Tokens are stored plaintext (single-machine dev DB). For production,
 * encrypt with the existing AuthService.fixedEncryption helper.
 */
@ApiTags('OAuth')
@Controller('/oauth')
export class IlluminatiOAuthController {
  private readonly logger = new Logger(IlluminatiOAuthController.name);

  // Google OAuth 2.0 endpoints.
  private readonly GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
  private readonly GOOGLE_USERINFO =
    'https://openidconnect.googleapis.com/v1/userinfo';
  private readonly GOOGLE_SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive.readonly',
  ];

  // Facebook Login for Business endpoints (Instagram Graph API auth path).
  private readonly FB_AUTH = 'https://www.facebook.com/v18.0/dialog/oauth';
  private readonly FB_TOKEN = 'https://graph.facebook.com/v18.0/oauth/access_token';
  private readonly FB_GRAPH = 'https://graph.facebook.com/v18.0';
  private readonly META_SCOPES = [
    'instagram_basic',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
    // business_management is required to enumerate Pages owned by a Business
    // Manager via /me/businesses/{id}/owned_pages — without it, BM-owned
    // Pages do NOT appear in /me/accounts even when the user is an admin.
    'business_management',
  ];

  constructor(private prisma: PrismaService) {}

  // =========================================================================
  // Google
  // =========================================================================

  @Get('/google/start')
  startGoogle(@Res() res: Response) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new HttpException(
        { error: 'GOOGLE_CLIENT_ID_NOT_CONFIGURED' },
        503
      );
    }
    const redirectUri = this.googleRedirectUri();
    const url = new URL(this.GOOGLE_AUTH);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.GOOGLE_SCOPES.join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent'); // force refresh_token issuance every time
    url.searchParams.set('include_granted_scopes', 'true');
    res.redirect(url.toString());
  }

  @Get('/google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response
  ) {
    if (error || !code) {
      return res.redirect(this.frontendUrl(`/auth/login?error=${encodeURIComponent(error ?? 'no_code')}`));
    }
    try {
      const tokenRes = await fetch(this.GOOGLE_TOKEN, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: this.googleRedirectUri(),
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok) {
        const detail = await tokenRes.text();
        this.logger.warn(`Google token exchange failed: ${detail.slice(0, 300)}`);
        return res.redirect(this.frontendUrl('/auth/login?error=google_token_exchange'));
      }
      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope: string;
      };

      // Pull the connected Google email so we can show it in Settings.
      let email: string | null = null;
      try {
        const userinfo = await fetch(this.GOOGLE_USERINFO, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (userinfo.ok) {
          const data = (await userinfo.json()) as { email?: string };
          email = data.email ?? null;
        }
      } catch (e) {
        this.logger.warn(`Google userinfo fetch failed: ${(e as Error).message}`);
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      await this.prisma.user.update({
        where: { id: await this.demoUserId() },
        data: {
          googleAccessToken: tokens.access_token,
          // Google only returns refresh_token on the first consent — preserve a
          // prior one if this is a re-consent without rotation.
          ...(tokens.refresh_token
            ? { googleRefreshToken: tokens.refresh_token }
            : {}),
          googleExpiresAt: expiresAt,
          googleEmail: email,
          googleConnectedAt: new Date(),
        },
      });

      await this.signInUser(res, await this.demoUserId());
      return res.redirect(
        this.frontendUrl('/onboarding/connecting?provider=google&status=success')
      );
    } catch (e) {
      this.logger.error('Google callback crashed', e as Error);
      return res.redirect(this.frontendUrl('/auth/login?error=google_callback'));
    }
  }

  // =========================================================================
  // Instagram (via Facebook Login for Business)
  // =========================================================================

  @Get('/instagram/start')
  startInstagram(@Res() res: Response) {
    const clientId = process.env.META_APP_ID;
    if (!clientId) {
      throw new HttpException(
        { error: 'META_APP_ID_NOT_CONFIGURED' },
        503
      );
    }
    const redirectUri = this.instagramRedirectUri();
    const url = new URL(this.FB_AUTH);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.META_SCOPES.join(','));
    // Force the consent screen to render every time so newly-added scopes
    // (e.g. business_management) get explicitly granted without making the
    // user manually remove the app from facebook.com → Business Integrations.
    url.searchParams.set('auth_type', 'rerequest');
    res.redirect(url.toString());
  }

  @Get('/instagram/callback')
  async instagramCallback(
    @Req() req: Request,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_reason') errorReason: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response
  ) {
    // ── step 0 ───────────────────────────────────────────────────────────
    // Always log the full callback for debugging. The `req.url` is the path
    // + query exactly as it arrived from facebook.com.
    const fullCallbackUrl = `${this.backendBase()}${req.url}`;
    this.logger.log(`[IG callback] hit: ${fullCallbackUrl}`);
    this.logger.log(
      `[IG callback] params: code=${code ? `${code.slice(0, 12)}…` : '(missing)'} ` +
        `error=${error ?? '(none)'} error_reason=${errorReason ?? '(none)'} ` +
        `error_description=${errorDescription ?? '(none)'}`
    );

    if (error || !code) {
      const reason =
        errorDescription ?? errorReason ?? error ?? 'no_code';
      this.logger.warn(
        `[IG callback] short-circuiting: provider returned error/no code → ${reason}`
      );
      return res.redirect(
        this.frontendUrl(`/auth/login?error=${encodeURIComponent(reason)}`)
      );
    }

    try {
      // ── step 1: short-lived user token ─────────────────────────────────
      const tokenUrl = new URL(this.FB_TOKEN);
      tokenUrl.searchParams.set('client_id', process.env.META_APP_ID!);
      tokenUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!);
      tokenUrl.searchParams.set('redirect_uri', this.instagramRedirectUri());
      tokenUrl.searchParams.set('code', code);
      this.logger.log(
        `[IG callback] step 1 — POST token exchange. redirect_uri=${this.instagramRedirectUri()}`
      );

      const tokenRes = await fetch(tokenUrl.toString());
      const tokenBody = await tokenRes.text();
      this.logger.log(
        `[IG callback] step 1 result: HTTP ${tokenRes.status} body=${tokenBody.slice(0, 400)}`
      );
      if (!tokenRes.ok) {
        return res.redirect(
          this.frontendUrl(
            `/auth/login?error=meta_token_exchange&detail=${encodeURIComponent(tokenBody.slice(0, 200))}`
          )
        );
      }
      const short = JSON.parse(tokenBody) as {
        access_token: string;
        expires_in?: number;
      };

      // ── step 2: long-lived user token (60-day TTL) ─────────────────────
      const longUrl = new URL(this.FB_TOKEN);
      longUrl.searchParams.set('grant_type', 'fb_exchange_token');
      longUrl.searchParams.set('client_id', process.env.META_APP_ID!);
      longUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!);
      longUrl.searchParams.set('fb_exchange_token', short.access_token);
      this.logger.log('[IG callback] step 2 — extending to long-lived token');
      const longRes = await fetch(longUrl.toString());
      const longBody = await longRes.text();
      this.logger.log(
        `[IG callback] step 2 result: HTTP ${longRes.status} body=${longBody.slice(0, 400)}`
      );
      const long = longRes.ok
        ? (JSON.parse(longBody) as { access_token: string })
        : null;
      const fbToken = long?.access_token ?? short.access_token;

      // ── step 3a: dump granted permissions so we can see what's missing ──
      this.logger.log('[IG callback] step 3a — GET /me/permissions');
      const permRes = await fetch(
        `${this.FB_GRAPH}/me/permissions?access_token=${encodeURIComponent(fbToken)}`
      );
      const permBody = await permRes.text();
      this.logger.log(
        `[IG callback] step 3a result: HTTP ${permRes.status} body=${permBody.slice(0, 800)}`
      );

      // ── step 3b: direct admin Pages via /me/accounts ───────────────────
      this.logger.log('[IG callback] step 3b — GET /me/accounts');
      const pagesRes = await fetch(
        `${this.FB_GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(fbToken)}`
      );
      const pagesBody = await pagesRes.text();
      this.logger.log(
        `[IG callback] step 3b result: HTTP ${pagesRes.status} body=${pagesBody}`
      );
      const pagesPayload = JSON.parse(pagesBody) as {
        data?: Page[];
        error?: { message: string };
      };
      if (!pagesRes.ok || pagesPayload.error) {
        this.logger.warn(
          `[IG callback] step 3b error: ${pagesPayload.error?.message ?? 'unknown'}`
        );
      }
      const directPages: Page[] = pagesPayload.data ?? [];
      this.logger.log(
        `[IG callback] step 3b summary: ${directPages.length} Page(s) returned: ` +
          (directPages
            .map(
              (p) =>
                `${p.name}(${p.id})${p.instagram_business_account ? ' [IG: ' + p.instagram_business_account.id + ']' : ' [no IG]'}`
            )
            .join(', ') || '(none)')
      );

      // ── step 3c: Business-Manager-owned Pages ─────────────────────────
      // Pages owned by a Business Manager don't appear in /me/accounts. Walk
      // /me/businesses → /{id}/owned_pages + /{id}/client_pages instead.
      const bmPages: Page[] = [];
      this.logger.log('[IG callback] step 3c — GET /me/businesses');
      const bizRes = await fetch(
        `${this.FB_GRAPH}/me/businesses?fields=id,name&access_token=${encodeURIComponent(fbToken)}`
      );
      const bizBody = await bizRes.text();
      this.logger.log(
        `[IG callback] step 3c result: HTTP ${bizRes.status} body=${bizBody}`
      );
      let businesses: Array<{ id: string; name: string }> = [];
      try {
        businesses = (JSON.parse(bizBody) as { data?: Array<{ id: string; name: string }> }).data ?? [];
      } catch {}
      for (const biz of businesses) {
        for (const edge of ['owned_pages', 'client_pages'] as const) {
          this.logger.log(`[IG callback] step 3c — GET /${biz.id}/${edge}`);
          const r = await fetch(
            `${this.FB_GRAPH}/${biz.id}/${edge}?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(fbToken)}`
          );
          const b = await r.text();
          this.logger.log(
            `[IG callback] step 3c /${biz.id}/${edge} result: HTTP ${r.status} body=${b}`
          );
          if (!r.ok) continue;
          try {
            const parsed = JSON.parse(b) as { data?: Page[] };
            for (const p of parsed.data ?? []) {
              if (!bmPages.some((x) => x.id === p.id)) bmPages.push(p);
            }
          } catch {}
        }
      }
      this.logger.log(
        `[IG callback] step 3c summary: ${bmPages.length} BM Page(s): ` +
          (bmPages
            .map(
              (p) =>
                `${p.name}(${p.id})${p.instagram_business_account ? ' [IG: ' + p.instagram_business_account.id + ']' : ' [no IG]'}`
            )
            .join(', ') || '(none)')
      );

      // Prefer a Page that already has an IG Business account linked.
      const allPages: Page[] = [...directPages, ...bmPages];
      const pageWithIg =
        allPages.find((p) => p.instagram_business_account) ?? null;

      // ── step 4: hydrate IG profile if we found one ────────────────────
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
        const fields =
          'id,username,followers_count,media_count,biography,profile_picture_url';
        this.logger.log(`[IG callback] step 4 — GET /${igId}?fields=${fields}`);
        const igRes = await fetch(
          `${this.FB_GRAPH}/${igId}?fields=${fields}&access_token=${encodeURIComponent(pageWithIg.access_token)}`
        );
        const igBody = await igRes.text();
        this.logger.log(
          `[IG callback] step 4 result: HTTP ${igRes.status} body=${igBody.slice(0, 400)}`
        );
        if (igRes.ok) {
          igProfile = JSON.parse(igBody) as typeof igProfile;
        }
      } else {
        this.logger.warn(
          '[IG callback] step 4 skipped: no Page with linked IG Business account. ' +
            'Link an IG Business/Creator account to a FB Page at business.facebook.com → Accounts → Instagram Accounts.'
        );
      }

      // IMPORTANT: store the *Page* access token (not the user token) — it's
      // what's needed for all subsequent IG Graph API calls (media, insights).
      // Page tokens issued from a long-lived user token are themselves
      // long-lived (no expiry).
      const tokenForIgCalls = pageWithIg?.access_token ?? fbToken;
      // Only mark the user as "Instagram connected" when we actually pulled an
      // IG profile. Otherwise the rest of the app will treat the empty FB
      // session as a usable IG connection and silently show stale mock data.
      const fullyConnected = !!igProfile;
      await this.prisma.user.update({
        where: { id: await this.demoUserId() },
        data: {
          instagramAccessToken: tokenForIgCalls,
          instagramUserId: igProfile?.id ?? pageWithIg?.instagram_business_account?.id ?? null,
          instagramHandle: igProfile?.username
            ? `@${igProfile.username}`
            : null,
          instagramFollowers: igProfile?.followers_count ?? null,
          instagramMediaCount: igProfile?.media_count ?? null,
          instagramBio: igProfile?.biography ?? null,
          instagramProfilePic: igProfile?.profile_picture_url ?? null,
          instagramConnectedAt: fullyConnected ? new Date() : null,
        },
      });

      await this.signInUser(res, await this.demoUserId());
      const hadProfile = !!igProfile;
      this.logger.log(
        `[IG callback] success — hadProfile=${hadProfile} handle=${igProfile?.username ?? '(none)'} ` +
          `followers=${igProfile?.followers_count ?? 'n/a'}`
      );
      if (hadProfile) {
        return res.redirect(
          this.frontendUrl('/onboarding/connecting?provider=instagram&status=success')
        );
      }
      // No usable IG profile — stop the loader, stay on /auth/login with a
      // clear error so the user can act on it.
      return res.redirect(
        this.frontendUrl(
          '/auth/login?error=no_ig_business&detail=' +
            encodeURIComponent(
              'Facebook returned 0 Pages. Link an IG Business or Creator account to a Facebook Page at business.facebook.com → Accounts → Instagram, then click Connect again.'
            )
        )
      );
    } catch (e) {
      const err = e as Error;
      this.logger.error(
        `[IG callback] CRASH: ${err.message}\n${err.stack ?? '(no stack)'}`
      );
      return res.redirect(
        this.frontendUrl(
          `/auth/login?error=instagram_callback&detail=${encodeURIComponent(err.message.slice(0, 200))}`
        )
      );
    }
  }

  // =========================================================================
  // helpers
  // =========================================================================

  private frontendUrl(path: string): string {
    const base = process.env.FRONTEND_URL ?? 'http://localhost:4200';
    return `${base.replace(/\/$/, '')}${path}`;
  }

  private backendBase(): string {
    return (process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  private googleRedirectUri(): string {
    const base = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/oauth/google/callback`;
  }

  private instagramRedirectUri(): string {
    const base = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/oauth/instagram/callback`;
  }

  /**
   * Single-tenant demo mode: link OAuth tokens to the seeded admin user.
   * Multi-tenant would encode userId into OAuth `state` (signed with JWT_SECRET)
   * and decode on callback.
   *
   * Self-heals on first run after a fresh `prisma db push` — creates the user,
   * org, and membership if they don't exist yet, so OAuth callbacks succeed on
   * an empty DB instead of crashing with DEMO_USER_NOT_SEEDED.
   */
  private async demoUserId(): Promise<string> {
    const existing = await this.prisma.user.findFirst({
      where: { email: 'opnclaw123@gmail.com', providerName: 'LOCAL' },
    });
    if (existing) return existing.id;

    this.logger.warn(
      '[IG/Google callback] demo user not found — auto-creating opnclaw123@gmail.com + org'
    );
    const created = await this.prisma.user.create({
      data: {
        email: 'opnclaw123@gmail.com',
        providerName: 'LOCAL',
        timezone: 0,
        isSuperAdmin: true,
        organizations: {
          create: {
            role: 'SUPERADMIN',
            organization: {
              create: { name: 'Illuminati' },
            },
          },
        },
      },
    });
    return created.id;
  }

  /**
   * Mints a JWT auth cookie for the given user so the post-OAuth redirect lands
   * the browser fully signed in to the frontend — matches the cookie format
   * used by /auth/login.
   */
  private async signInUser(res: Response, userId: string) {
    const u = (await this.prisma.user.findUnique({ where: { id: userId } })) as User;
    if (!u) return;
    const jwt = AuthService.signJWT(u);
    res.cookie('auth', jwt, {
      domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
      ...(!process.env.NOT_SECURED
        ? { secure: true, httpOnly: true, sameSite: 'none' as const }
        : {}),
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    });
  }
}
