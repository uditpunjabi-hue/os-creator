import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

const FB_GRAPH = 'https://graph.facebook.com/v18.0';

interface DiscoveryResult {
  followers: number | null;
  engagement: number | null;
  note: string | null;
}

async function lookupHandle(orgId: string, handle: string): Promise<DiscoveryResult | null> {
  const user = await prisma.user.findFirst({
    where: {
      instagramConnectedAt: { not: null },
      organizations: { some: { organizationId: orgId, disabled: false } },
    },
    select: { instagramAccessToken: true, instagramUserId: true },
  });
  if (!user?.instagramAccessToken || !user.instagramUserId) {
    return {
      followers: null,
      engagement: null,
      note: 'Connect Instagram to enable competitor stats lookup.',
    };
  }
  try {
    const fields = `business_discovery.username(${handle}){followers_count,media_count,biography,media.limit(5){like_count,comments_count}}`;
    const url = `${FB_GRAPH}/${user.instagramUserId}?fields=${encodeURIComponent(
      fields
    )}&access_token=${encodeURIComponent(user.instagramAccessToken)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return {
        followers: null,
        engagement: null,
        note: 'Could not fetch — IG account may be private or unreachable via Business Discovery.',
      };
    }
    const parsed = (await res.json()) as {
      business_discovery?: {
        followers_count?: number;
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
      engagement = Math.round((total / recent.length / followers) * 100 * 100) / 100;
    }
    return { followers, engagement, note: bd.biography?.slice(0, 200) ?? null };
  } catch (e) {
    return { followers: null, engagement: null, note: `Lookup failed: ${(e as Error).message}` };
  }
}

export const GET = withErrorHandling(async () => {
  const { org } = await getAuth();
  const rows = await prisma.competitor.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(rows);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const { handle: handleRaw } = (await req.json().catch(() => ({}))) as { handle?: string };
  const handle = (handleRaw ?? '').replace(/^@/, '').trim().toLowerCase();
  if (!handle) return errorResponse(400, 'handle required');

  const lookup = await lookupHandle(org.id, handle);
  const row = await prisma.competitor.upsert({
    where: {
      organizationId_handle_platform: {
        organizationId: org.id,
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
      organizationId: org.id,
      handle: `@${handle}`,
      platform: 'instagram',
      followers: lookup?.followers ?? null,
      engagement: lookup?.engagement ?? null,
      notes: lookup?.note ?? null,
    },
  });
  return NextResponse.json(row);
});
