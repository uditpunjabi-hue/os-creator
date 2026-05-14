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
 */
export const GET = withErrorHandling(async () => {
  const { user, org } = await getAuth();

  const membership = await prisma.userOrganization.findFirst({
    where: { userId: user.id, organizationId: org.id, disabled: false },
    select: { role: true },
  });

  const isBillingOn = !!process.env.STRIPE_PUBLISHABLE_KEY;
  const role = membership?.role ?? 'USER';

  const { password: _pw, ...userSafe } = user as typeof user & { password?: string | null };

  return NextResponse.json({
    ...userSafe,
    orgId: org.id,
    role,
    tier: isBillingOn ? 'FREE' : 'ULTIMATE',
    totalChannels: isBillingOn ? 5 : 10_000,
    isLifetime: false,
    admin: !!user.isSuperAdmin,
    impersonate: false,
    isTrailing: false,
    allowTrial: org.allowTrial,
    streakSince: org.streakSince ?? null,
    userMode: (user as { userMode?: string }).userMode ?? 'CREATOR',
    publicApi: role === 'SUPERADMIN' || role === 'ADMIN' ? org.apiKey ?? '' : '',
  });
});
