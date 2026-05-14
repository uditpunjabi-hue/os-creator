import { NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async () => {
  const { org } = await getAuth();
  const scripts = await prisma.script.findMany({
    where: { organizationId: org.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      format: true,
      prompt: true,
      body: true,
      feedback: true,
      status: true,
      pipelineStatus: true,
      qualityScore: true,
      scheduledAt: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(scripts);
});
