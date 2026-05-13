import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

const FB_GRAPH = 'https://graph.facebook.com/v18.0';

/**
 * Competitor lookup via Instagram Business Discovery.
 *
 * The Discovery endpoint only works for OTHER Business/Creator accounts and
 * requires you to be querying THROUGH your own connected IG Business account
 * (i.e. uses your stored page access token). Public/personal IG accounts and
 * accounts you can't reach via Discovery will return a Meta error, in which
 * case we store the handle with all-null stats so it still appears in the UI.
 */
@Injectable()
export class InstagramCompetitorService {
  private readonly logger = new Logger(InstagramCompetitorService.name);

  constructor(private prisma: PrismaService) {}

  async list(orgId: string) {
    return this.prisma.competitor.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addAndSync(orgId: string, handleRaw: string) {
    const handle = handleRaw.replace(/^@/, '').trim().toLowerCase();
    if (!handle) {
      throw new Error('handle required');
    }
    const lookup = await this.lookupHandle(orgId, handle);
    return this.prisma.competitor.upsert({
      where: {
        organizationId_handle_platform: {
          organizationId: orgId,
          handle: `@${handle}`,
          platform: 'instagram',
        },
      },
      update: {
        followers: lookup?.followers ?? null,
        engagement: lookup?.engagement ?? null,
        notes: lookup?.note ?? null,
      },
      create: {
        organizationId: orgId,
        handle: `@${handle}`,
        platform: 'instagram',
        followers: lookup?.followers ?? null,
        engagement: lookup?.engagement ?? null,
        notes: lookup?.note ?? null,
      },
    });
  }

  async resync(orgId: string, id: string) {
    const existing = await this.prisma.competitor.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new Error('competitor not found');
    const lookup = await this.lookupHandle(orgId, existing.handle.replace(/^@/, ''));
    return this.prisma.competitor.update({
      where: { id },
      data: {
        followers: lookup?.followers ?? existing.followers,
        engagement: lookup?.engagement ?? existing.engagement,
        notes: lookup?.note ?? existing.notes,
      },
    });
  }

  async remove(orgId: string, id: string) {
    await this.prisma.competitor.deleteMany({ where: { id, organizationId: orgId } });
    return { ok: true };
  }

  /**
   * Calls business_discovery on the connected user's own IG Business account.
   * Returns null if we can't look it up (account is private/personal/blocked).
   */
  private async lookupHandle(
    orgId: string,
    handle: string
  ): Promise<{ followers: number | null; engagement: number | null; note: string | null } | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        instagramConnectedAt: { not: null },
        organizations: { some: { organizationId: orgId, disabled: false } },
      },
      select: { instagramAccessToken: true, instagramUserId: true },
    });
    if (!user?.instagramAccessToken || !user.instagramUserId) {
      this.logger.warn('competitor lookup: no IG connection — storing handle with null stats');
      return { followers: null, engagement: null, note: 'Connect Instagram to enable competitor stats lookup.' };
    }

    try {
      // Discovery: fetch follower/media counts + 5 most recent media for engagement calc.
      const fields = `business_discovery.username(${handle}){followers_count,media_count,biography,media.limit(5){like_count,comments_count}}`;
      const url = `${FB_GRAPH}/${user.instagramUserId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(user.instagramAccessToken)}`;
      const res = await fetch(url);
      const body = await res.text();
      this.logger.log(
        `[competitor lookup ${handle}] HTTP ${res.status} body=${body.slice(0, 400)}`
      );
      if (!res.ok) {
        return { followers: null, engagement: null, note: 'Could not fetch — IG account may be private or unreachable via Business Discovery.' };
      }
      const parsed = JSON.parse(body) as {
        business_discovery?: {
          followers_count?: number;
          media_count?: number;
          biography?: string;
          media?: { data?: Array<{ like_count?: number; comments_count?: number }> };
        };
        error?: { message: string };
      };
      const bd = parsed.business_discovery;
      if (!bd) {
        return { followers: null, engagement: null, note: parsed.error?.message ?? 'No discovery data.' };
      }
      const recent = bd.media?.data ?? [];
      const followers = bd.followers_count ?? null;
      let engagement: number | null = null;
      if (followers && followers > 0 && recent.length > 0) {
        const total = recent.reduce(
          (s, m) => s + (m.like_count ?? 0) + (m.comments_count ?? 0),
          0
        );
        engagement = Math.round(((total / recent.length) / followers) * 100 * 100) / 100;
      }
      return {
        followers,
        engagement,
        note: bd.biography?.slice(0, 200) ?? null,
      };
    } catch (e) {
      this.logger.warn(`competitor lookup ${handle} crashed: ${(e as Error).message}`);
      return { followers: null, engagement: null, note: 'Lookup failed.' };
    }
  }
}
