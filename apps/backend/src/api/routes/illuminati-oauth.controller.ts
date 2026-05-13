import {
  Controller,
  Get,
  HttpException,
  Logger,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';
import type { User } from '@prisma/client';

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
    res.redirect(url.toString());
  }

  @Get('/instagram/callback')
  async instagramCallback(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response
  ) {
    if (error || !code) {
      return res.redirect(this.frontendUrl(`/auth/login?error=${encodeURIComponent(error ?? 'no_code')}`));
    }
    try {
      // 1) Exchange auth code → short-lived FB user access token.
      const tokenUrl = new URL(this.FB_TOKEN);
      tokenUrl.searchParams.set('client_id', process.env.META_APP_ID!);
      tokenUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!);
      tokenUrl.searchParams.set('redirect_uri', this.instagramRedirectUri());
      tokenUrl.searchParams.set('code', code);

      const tokenRes = await fetch(tokenUrl.toString());
      if (!tokenRes.ok) {
        const detail = await tokenRes.text();
        this.logger.warn(`Meta token exchange failed: ${detail.slice(0, 300)}`);
        return res.redirect(this.frontendUrl('/auth/login?error=meta_token_exchange'));
      }
      const short = (await tokenRes.json()) as {
        access_token: string;
        expires_in?: number;
      };

      // 2) Extend to long-lived user token (~60 day TTL).
      const longUrl = new URL(this.FB_TOKEN);
      longUrl.searchParams.set('grant_type', 'fb_exchange_token');
      longUrl.searchParams.set('client_id', process.env.META_APP_ID!);
      longUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!);
      longUrl.searchParams.set('fb_exchange_token', short.access_token);
      const longRes = await fetch(longUrl.toString());
      const long = longRes.ok
        ? ((await longRes.json()) as { access_token: string })
        : null;
      const fbToken = long?.access_token ?? short.access_token;

      // 3) Find a Facebook Page → its linked Instagram Business account.
      const pagesRes = await fetch(
        `${this.FB_GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(fbToken)}`
      );
      const pagesPayload = (await pagesRes.json()) as {
        data?: Array<{
          id: string;
          name: string;
          access_token: string;
          instagram_business_account?: { id: string };
        }>;
        error?: { message: string };
      };
      if (!pagesRes.ok || pagesPayload.error) {
        this.logger.warn(
          `Meta /me/accounts failed: ${pagesPayload.error?.message ?? 'unknown'}`
        );
      }
      const pageWithIg =
        pagesPayload.data?.find((p) => p.instagram_business_account) ?? null;

      // 4) Pull IG profile fields if we got a Business account id.
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
        const igRes = await fetch(
          `${this.FB_GRAPH}/${igId}?fields=${fields}&access_token=${encodeURIComponent(pageWithIg.access_token)}`
        );
        if (igRes.ok) {
          igProfile = (await igRes.json()) as typeof igProfile;
        } else {
          this.logger.warn(
            `IG profile fetch failed: ${(await igRes.text()).slice(0, 200)}`
          );
        }
      } else {
        this.logger.warn(
          'No FB Page with linked Instagram Business account found. User likely needs to link IG to a Page in business.facebook.com.'
        );
      }

      // IMPORTANT: store the *Page* access token (not the user token) — it's
      // what's needed for all subsequent IG Graph API calls (media, insights).
      // Page tokens issued from a long-lived user token are themselves
      // long-lived (no expiry).
      const tokenForIgCalls = pageWithIg?.access_token ?? fbToken;
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
          instagramConnectedAt: new Date(),
        },
      });

      await this.signInUser(res, await this.demoUserId());
      // If we couldn't pull a profile, still redirect with success — Settings
      // will show "connected but no IG Business account linked" in that case.
      const hadProfile = !!igProfile;
      const target = hadProfile
        ? '/onboarding/connecting?provider=instagram&status=success'
        : '/onboarding/connecting?provider=instagram&status=success&warning=no_ig_business';
      return res.redirect(this.frontendUrl(target));
    } catch (e) {
      this.logger.error('Instagram callback crashed', e as Error);
      return res.redirect(this.frontendUrl('/auth/login?error=instagram_callback'));
    }
  }

  // =========================================================================
  // helpers
  // =========================================================================

  private frontendUrl(path: string): string {
    const base = process.env.FRONTEND_URL ?? 'http://localhost:4200';
    return `${base.replace(/\/$/, '')}${path}`;
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
   */
  private async demoUserId(): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { email: 'opnclaw123@gmail.com', providerName: 'LOCAL' },
    });
    if (!user) {
      throw new HttpException(
        { error: 'DEMO_USER_NOT_SEEDED' },
        500
      );
    }
    return user.id;
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
