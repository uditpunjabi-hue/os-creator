import { NextRequest, NextResponse } from 'next/server';
import { Prisma, DealStage } from '@prisma/client';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { decimalRecord } from '@gitroom/frontend/lib/server/decimal';

export const runtime = 'nodejs';

interface CreateBody {
  brand?: string;
  influencerId?: string;
  offer?: number | string;
  floor?: number | string | null;
  ceiling?: number | string | null;
  stage?: DealStage;
  notes?: string;
}

export const GET = withErrorHandling(async () => {
  const { org } = await getAuth();
  const rows = await prisma.deal.findMany({
    where: { organizationId: org.id },
    include: { influencer: { select: { id: true, name: true, handle: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json(rows.map(decimalRecord));
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const body = (await req.json().catch(() => ({}))) as CreateBody;
  if (!body.brand) return errorResponse(400, 'brand required');
  if (!body.influencerId) return errorResponse(400, 'influencerId required');
  if (body.offer === undefined || body.offer === null) {
    return errorResponse(400, 'offer required');
  }
  const row = await prisma.deal.create({
    data: {
      organizationId: org.id,
      brand: body.brand,
      influencerId: body.influencerId,
      offer: new Prisma.Decimal(body.offer),
      floor: body.floor != null ? new Prisma.Decimal(body.floor) : null,
      ceiling: body.ceiling != null ? new Prisma.Decimal(body.ceiling) : null,
      stage: body.stage ?? DealStage.LEAD,
      notes: body.notes,
    },
    include: { influencer: { select: { id: true, name: true, handle: true } } },
  });
  return NextResponse.json(decimalRecord(row));
});
