import 'server-only';
import { cookies } from 'next/headers';
import { verify, sign } from 'jsonwebtoken';
import type { Organization, User } from '@prisma/client';
import { prisma } from './prisma';

const DEMO_EMAIL = 'opnclaw123@gmail.com';

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function signJWT(value: object): string {
  return sign(value, process.env.JWT_SECRET!);
}

export function verifyJWT(token: string): { id?: string; email?: string } | null {
  try {
    return verify(token, process.env.JWT_SECRET!) as { id?: string; email?: string };
  } catch {
    return null;
  }
}

/**
 * Single-tenant demo helper — the OAuth callbacks and the auth fallback
 * both converge on opnclaw123@gmail.com + the Illuminati org. Creates the
 * user + org on first call so a fresh `prisma db push` against a clean
 * Supabase DB self-heals without a seed step.
 */
export async function ensureDemoUser(): Promise<User> {
  const existing = await prisma.user.findFirst({
    where: { email: DEMO_EMAIL, providerName: 'LOCAL' },
  });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      providerName: 'LOCAL',
      timezone: 0,
      isSuperAdmin: true,
      organizations: {
        create: {
          role: 'SUPERADMIN',
          organization: { create: { name: 'Illuminati' } },
        },
      },
    },
  });
}

/**
 * Read JWT cookie → user; fall back to the demo user when no/invalid cookie.
 * Mirrors the NestJS AuthMiddleware exactly so behaviour is identical
 * whether the request hits the Express backend or these route handlers.
 */
export async function getCurrentUser(): Promise<User> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth')?.value;
  if (token) {
    const decoded = verifyJWT(token);
    if (decoded?.id) {
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (user) return user;
    }
  }
  return ensureDemoUser();
}

/**
 * Resolve the current org for a user. Honors `showorg` cookie if set and
 * the user is a member; otherwise returns the user's first org.
 */
export async function getCurrentOrg(user: User): Promise<Organization> {
  const cookieStore = await cookies();
  const showOrgId = cookieStore.get('showorg')?.value;

  const memberships = await prisma.userOrganization.findMany({
    where: { userId: user.id, disabled: false },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  });

  if (memberships.length === 0) {
    throw new AuthError(403, 'User has no organization');
  }

  if (showOrgId) {
    const match = memberships.find((m) => m.organizationId === showOrgId);
    if (match) return match.organization;
  }

  return memberships[0].organization;
}

/** Convenience: get user + org in one call. */
export async function getAuth(): Promise<{ user: User; org: Organization }> {
  const user = await getCurrentUser();
  const org = await getCurrentOrg(user);
  return { user, org };
}
