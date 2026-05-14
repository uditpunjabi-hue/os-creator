import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

const VALID_PLATFORMS = new Set(['instagram', 'tiktok', 'youtube', 'linkedin', 'x']);
const VALID_KINDS = new Set(['IMAGE', 'CAROUSEL', 'REEL', 'STORY']);

interface CreateBody {
  caption?: string;
  scriptId?: string;
  contentPieceId?: string;
  kind?: string;
  platforms?: string[];
  scheduledAt?: string;
}

/**
 * Lists every scheduled post for the org. The Schedule page's /schedule
 * endpoint already returns the windowed view; this is the unbounded list
 * used for "View all" / search.
 */
export const GET = withErrorHandling(async () => {
  const { org } = await getAuth();
  const posts = await prisma.scheduledPost.findMany({
    where: { organizationId: org.id },
    orderBy: { scheduledAt: 'desc' },
    take: 200,
  });
  return NextResponse.json(
    posts.map((p) => ({
      id: p.id,
      caption: p.caption,
      kind: p.kind,
      status: p.status,
      platforms: p.platforms ?? [],
      scheduledAt: p.scheduledAt.toISOString(),
      publishedAt: p.publishedAt?.toISOString() ?? null,
    }))
  );
});

/**
 * Schedule a new post. Either:
 *   - { scriptId } — pull caption/format from the linked Script
 *   - { contentPieceId } — pull from the ContentPiece (preferred when a piece
 *     already exists from the filming workflow)
 *   - { caption } directly
 *
 * ScheduledPost requires an influencerId. We pick the org's first Influencer;
 * if none exists yet, we create a stub so the FK is satisfied — the org row
 * always has SOMEONE doing the posting in single-creator mode.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const body = (await req.json().catch(() => ({}))) as CreateBody;

  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (!scheduledAt || Number.isNaN(+scheduledAt)) {
    return errorResponse(400, 'scheduledAt is required (ISO datetime)');
  }
  const platforms = (body.platforms ?? []).filter((p) => VALID_PLATFORMS.has(p));
  if (platforms.length === 0) {
    return errorResponse(400, 'At least one valid platform is required');
  }
  const kind = body.kind && VALID_KINDS.has(body.kind) ? body.kind : 'REEL';

  // Resolve the caption + kind from the linked script or piece if given.
  let caption = (body.caption ?? '').trim();
  let resolvedKind: string = kind;
  if (!caption && body.contentPieceId) {
    const piece = await prisma.contentPiece.findFirst({
      where: { id: body.contentPieceId, organizationId: org.id },
    });
    if (piece) {
      caption = piece.caption || piece.title || piece.hook || '';
      if (piece.format) resolvedKind = mapFormatToKind(piece.format) ?? resolvedKind;
    }
  }
  if (!caption && body.scriptId) {
    const script = await prisma.script.findFirst({
      where: { id: body.scriptId, organizationId: org.id },
    });
    if (script) {
      const outputs = (script.agentOutputs ?? {}) as {
        revisedScript?: { caption?: string };
        script?: { caption?: string };
      };
      caption =
        outputs.revisedScript?.caption ??
        outputs.script?.caption ??
        script.title ??
        '';
      if (script.format) resolvedKind = mapFormatToKind(script.format) ?? resolvedKind;
    }
  }
  if (!caption) {
    return errorResponse(400, 'caption (or scriptId / contentPieceId) is required');
  }

  const influencerId = await ensureInfluencerId(org.id);

  const created = await prisma.scheduledPost.create({
    data: {
      organizationId: org.id,
      influencerId,
      caption,
      kind: resolvedKind as 'REEL',
      platforms,
      scheduledAt,
      status: 'SCHEDULED',
    },
  });

  // If the source was a ContentPiece, advance its stage so the Create page
  // reflects the hand-off and stops nagging.
  if (body.contentPieceId) {
    await prisma.contentPiece.update({
      where: { id: body.contentPieceId },
      data: { status: 'SCHEDULED', scheduledAt },
    });
  }

  return NextResponse.json({
    id: created.id,
    caption: created.caption,
    kind: created.kind,
    status: created.status,
    platforms: created.platforms ?? [],
    scheduledAt: created.scheduledAt.toISOString(),
  });
});

function mapFormatToKind(format: string): string | null {
  const f = format.toLowerCase();
  if (f.includes('reel')) return 'REEL';
  if (f.includes('carousel')) return 'CAROUSEL';
  if (f.includes('story')) return 'STORY';
  if (f.includes('post') || f.includes('image')) return 'IMAGE';
  return null;
}

async function ensureInfluencerId(orgId: string): Promise<string> {
  const existing = await prisma.influencer.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (existing) return existing.id;
  // Stub so the FK is satisfied for solo creators who haven't seeded one yet.
  const created = await prisma.influencer.create({
    data: { organizationId: orgId, name: 'My profile', platform: 'instagram' },
    select: { id: true },
  });
  return created.id;
}
