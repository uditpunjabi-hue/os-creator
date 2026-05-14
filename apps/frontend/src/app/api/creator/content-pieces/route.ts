import { NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async () => {
  const { org } = await getAuth();
  const pieces = await prisma.contentPiece.findMany({
    where: { organizationId: org.id },
    orderBy: { updatedAt: 'desc' },
    include: { script: { select: { id: true, title: true } } },
  });
  return NextResponse.json(pieces);
});
