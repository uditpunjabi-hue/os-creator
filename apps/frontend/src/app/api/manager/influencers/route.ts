import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

interface CreateBody {
  name?: string;
  handle?: string;
  platform?: string;
  followers?: number;
  engagement?: number;
  email?: string;
  phone?: string;
  notes?: string;
}

export const GET = withErrorHandling(async () => {
  const { org } = await getAuth();
  const rows = await prisma.influencer.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { deals: true, commercials: true } } },
  });
  return NextResponse.json(rows);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const body = (await req.json().catch(() => ({}))) as CreateBody;
  if (!body.name?.trim()) return errorResponse(400, 'name required');

  const row = await prisma.influencer.create({
    data: {
      organizationId: org.id,
      name: body.name.trim(),
      handle: body.handle?.trim() || null,
      platform: body.platform ?? 'instagram',
      followers: body.followers ?? null,
      engagement: body.engagement ?? null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      notes: body.notes?.trim() || null,
    },
  });
  return NextResponse.json(row);
});
