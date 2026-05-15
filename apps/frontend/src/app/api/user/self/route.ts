import { NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

/**
 * Returns a FLAT user object with org fields merged in — matching the NestJS
 * /user/self shape exactly. The layout's ContextWrapper expects:
 *   { ...user, orgId, tier, role, totalChannels, publicApi, userMode, ... }
 * and then transforms `tier` via the pricing[] map. Returning a nested
 * { user, org } breaks `user.tier === 'FREE'` checks in the layout.
 *
 * Stripe is not configured (no STRIPE_PUBLISHABLE_KEY) so we hardcode the
 * "fully unlocked" tier the original endpoint emits in that mode.
 *
 * NOTE: we hand-pick the columns in `select` rather than letting Prisma
 * default to SELECT *. This is the auth gate for the entire dashboard, so
 * a stale migration that adds a column on User must NEVER be able to take
 * the whole app down. Re-add fields to this select when the UI starts
 * needing them; everything else lives on dedicated endpoints.
 */
export const GET = withErrorHandling(async () => {
  const { user, org } = await getAuth();

  const [membership, fullUser] = await Promise.all([
    prisma.userOrganization.findFirst({
      where: { userId: user.id, organizationId: org.id, disabled: false },
      select: { role: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        lastName: true,
        bio: true,
        pictureId: true,
        timezone: true,
        isSuperAdmin: true,
        userMode: true,
        connectedAccount: true,
        instagramHandle: true,
      },
    }),
  ]);

  const isBillingOn = !!process.env.STRIPE_PUBLISHABLE_KEY;
  const role = membership?.role ?? 'USER';

  return NextResponse.json({
    id: user.id,
    email: fullUser?.email ?? user.email,
    name: fullUser?.name ?? null,
    lastName: fullUser?.lastName ?? null,
    bio: fullUser?.bio ?? null,
    pictureId: fullUser?.pictureId ?? null,
    timezone: fullUser?.timezone ?? 0,
    isSuperAdmin: !!fullUser?.isSuperAdmin,
    userMode: fullUser?.userMode ?? 'CREATOR',
    connectedAccount: !!fullUser?.connectedAccount,
    instagramHandle: fullUser?.instagramHandle ?? null,
    orgId: org.id,
    role,
    tier: isBillingOn ? 'FREE' : 'ULTIMATE',
    totalChannels: isBillingOn ? 5 : 10_000,
    isLifetime: false,
    admin: !!fullUser?.isSuperAdmin,
    impersonate: false,
    isTrailing: false,
    allowTrial: org.allowTrial,
    streakSince: org.streakSince ?? null,
    publicApi: role === 'SUPERADMIN' || role === 'ADMIN' ? org.apiKey ?? '' : '',
  });
});
