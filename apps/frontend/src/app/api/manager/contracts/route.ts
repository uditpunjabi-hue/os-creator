import { NextRequest, NextResponse } from 'next/server';
import { ContractStatus } from '@prisma/client';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

interface CreateBody {
  brand?: string;
  templateName?: string;
  influencerId?: string;
  dealId?: string | null;
  status?: ContractStatus;
  expiresAt?: string | null;
  documentUrl?: string;
}

export const GET = withErrorHandling(async () => {
  const { org } = await getAuth();
  const rows = await prisma.contract.findMany({
    where: { organizationId: org.id },
    include: { influencer: { select: { id: true, name: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json(rows);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const body = (await req.json().catch(() => ({}))) as CreateBody;
  if (!body.brand) return errorResponse(400, 'brand required');
  if (!body.templateName) return errorResponse(400, 'templateName required');
  if (!body.influencerId) return errorResponse(400, 'influencerId required');

  const row = await prisma.contract.create({
    data: {
      organizationId: org.id,
      brand: body.brand,
      templateName: body.templateName,
      influencerId: body.influencerId,
      dealId: body.dealId ?? undefined,
      status: body.status ?? ContractStatus.DRAFT,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      documentUrl: body.documentUrl,
    },
  });
  return NextResponse.json(row);
});
