import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async () => {
  const { user, org } = await getAuth();
  const sets = await prisma.hashtagSet.findMany({
    where: { organizationId: org.id, userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json({ sets });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { user, org } = await getAuth();
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    topic?: string;
    tags?: string[];
  };
  const name = (body.name ?? '').trim();
  const tags = Array.isArray(body.tags) ? body.tags.filter((t) => typeof t === 'string') : [];
  if (!name) return errorResponse(400, 'name is required');
  if (tags.length === 0) return errorResponse(400, 'at least one tag is required');
  const set = await prisma.hashtagSet.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      name: name.slice(0, 80),
      topic: body.topic?.slice(0, 120) ?? null,
      tags: tags.map((t) => (t.startsWith('#') ? t : `#${t}`).toLowerCase()).slice(0, 50),
    },
  });
  return NextResponse.json(set);
});
