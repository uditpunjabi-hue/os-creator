import { NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { memoryCache } from '@gitroom/frontend/lib/server/memory-cache';

export const runtime = 'nodejs';

/**
 * Clears the stored OAuth tokens + cached data for a connected provider.
 * Does NOT revoke the upstream grant (that requires a Google/Meta call which
 * the user can do from the platform's connected-apps screen); just removes
 * our local handles so the app behaves as "not connected" until they
 * reconnect via OAuth.
 */
export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ provider: string }> }) => {
    const { user, org } = await getAuth();
    const { provider } = await ctx.params;

    if (provider === 'google') {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          googleAccessToken: null,
          googleRefreshToken: null,
          googleExpiresAt: null,
          googleEmail: null,
          googleConnectedAt: null,
        },
      });
      memoryCache.delPattern(`gmail:list:${org.id}:*`);
      memoryCache.delPattern(`gmail:thread:${org.id}:*`);
      memoryCache.delPattern(`gcal:list:${org.id}:*`);
      return NextResponse.json({ ok: true });
    }

    if (provider === 'instagram') {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          instagramAccessToken: null,
          instagramUserId: null,
          instagramHandle: null,
          instagramFollowers: null,
          instagramMediaCount: null,
          instagramBio: null,
          instagramProfilePic: null,
          instagramConnectedAt: null,
        },
      });
      memoryCache.delPattern(`ig:media:${user.id}`);
      memoryCache.delPattern(`ig:ai-insights:${org.id}`);
      memoryCache.delPattern(`ig:weekly-report:${org.id}`);
      memoryCache.delPattern(`creator:intelligence:${org.id}`);
      return NextResponse.json({ ok: true });
    }

    return errorResponse(400, 'Unknown provider');
  }
);
