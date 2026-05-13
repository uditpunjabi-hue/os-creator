import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REFRESH_BUFFER_MS = 60 * 1000; // refresh if the token expires within 60s

@Injectable()
export class GoogleTokenService {
  private readonly logger = new Logger(GoogleTokenService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Returns a non-expired Google access token for the given user, refreshing
   * via the stored refresh_token if needed. Returns null when:
   *   - the user has no Google tokens stored,
   *   - we have no refresh_token and the access_token is expired,
   *   - the refresh request itself fails (treated as disconnect — clears
   *     the stored tokens so the UI prompts a reconnect).
   */
  async getValidAccessToken(userId: string): Promise<string | null> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        googleAccessToken: true,
        googleRefreshToken: true,
        googleExpiresAt: true,
      },
    });
    if (!u?.googleAccessToken) return null;

    const expiresAt = u.googleExpiresAt?.getTime() ?? 0;
    if (expiresAt - Date.now() > REFRESH_BUFFER_MS) {
      return u.googleAccessToken;
    }

    if (!u.googleRefreshToken) {
      this.logger.warn(
        `User ${userId} Google token expired and no refresh_token available — clearing connection.`
      );
      await this.clearConnection(userId);
      return null;
    }

    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: u.googleRefreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        this.logger.warn(`Google refresh failed (${res.status}): ${detail.slice(0, 200)}`);
        await this.clearConnection(userId);
        return null;
      }
      const data = (await res.json()) as {
        access_token: string;
        expires_in: number;
        refresh_token?: string; // rarely present on refresh, but preserve if so
      };
      const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: data.access_token,
          googleExpiresAt: newExpiresAt,
          ...(data.refresh_token ? { googleRefreshToken: data.refresh_token } : {}),
        },
      });
      return data.access_token;
    } catch (e) {
      this.logger.warn(`Google refresh crashed: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Find the user attached to this org who has Google connected, returning
   * a fresh access token. Returns null when nobody in the org is connected.
   */
  async getValidAccessTokenForOrg(orgId: string): Promise<{ userId: string; token: string } | null> {
    const u = await this.prisma.user.findFirst({
      where: {
        googleConnectedAt: { not: null },
        organizations: { some: { organizationId: orgId, disabled: false } },
      },
      select: { id: true },
    });
    if (!u) return null;
    const token = await this.getValidAccessToken(u.id);
    return token ? { userId: u.id, token } : null;
  }

  private async clearConnection(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
        googleExpiresAt: null,
        googleEmail: null,
        googleConnectedAt: null,
      },
    });
  }
}
