import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

interface ProfileBody {
  name?: string;
  lastName?: string;
  companyName?: string;
}

export const GET = withErrorHandling(async () => {
  const { user, org } = await getAuth();
  return NextResponse.json({
    name: user.name,
    lastName: user.lastName,
    email: user.email,
    companyName: org.name,
    connections: {
      google: {
        connected: !!user.googleConnectedAt,
        email: user.googleEmail,
        connectedAt: user.googleConnectedAt?.toISOString() ?? null,
      },
      instagram: {
        connected: !!user.instagramConnectedAt,
        handle: user.instagramHandle,
        followers: user.instagramFollowers,
        connectedAt: user.instagramConnectedAt?.toISOString() ?? null,
      },
    },
  });
});

export const PUT = withErrorHandling(async (req: NextRequest) => {
  const { user, org } = await getAuth();
  const body = (await req.json().catch(() => ({}))) as ProfileBody;
  const trimmedName = body.name?.trim();
  const trimmedLast = body.lastName?.trim();
  const trimmedCo = body.companyName?.trim();

  if (trimmedName !== undefined && !trimmedName) {
    return errorResponse(400, 'name cannot be empty');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(trimmedName !== undefined && { name: trimmedName }),
      ...(trimmedLast !== undefined && { lastName: trimmedLast }),
    },
  });
  if (trimmedCo) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { name: trimmedCo },
    });
  }
  return NextResponse.json({ ok: true });
});
