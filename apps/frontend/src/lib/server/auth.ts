import 'server-only';
import { cookies } from 'next/headers';
import { verify, sign } from 'jsonwebtoken';
import type { Organization, User } from '@prisma/client';
import { prisma } from './prisma';

// ---------------------------------------------------------------------------
// Auth — JWT cookie based. The OAuth callbacks mint the JWT on success;
// every server-side route that reads creator/manager data hard-401s when the
// cookie is missing or invalid (no more silent demo fallback). The frontend
// middleware redirects unauthenticated browsers to /auth/login before the API
// is ever called.
// ---------------------------------------------------------------------------

const AUTH_COOKIE = 'auth';

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
 * Resolve the current user from the JWT cookie. Throws AuthError(401) when:
 *   - no cookie present
 *   - cookie fails JWT verification (tampered or expired)
 *   - the encoded user id no longer exists (deleted account)
 *
 * Callers behind `withErrorHandling` automatically get a 401 JSON response,
 * which the middleware uses to redirect browsers to /auth/login.
 */
export async function getCurrentUser(): Promise<User> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) throw new AuthError(401, 'Not authenticated');
  const decoded = verifyJWT(token);
  if (!decoded?.id) throw new AuthError(401, 'Invalid session');
  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user) throw new AuthError(401, 'User no longer exists');
  return user;
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

// ---------------------------------------------------------------------------
// OAuth upsert helpers — used by the Instagram / Google callbacks. Each
// provider has its own lookup column (instagramUserId / googleEmail) so two
// users with the same Gmail can't trample each other through IG, and vice
// versa. Returns the user row (existing or newly created) plus a flag the
// caller uses to decide whether to send the user through onboarding.
// ---------------------------------------------------------------------------

export interface UpsertResult {
  user: User;
  isNewUser: boolean;
}

interface InstagramSignInArgs {
  instagramUserId: string;
  instagramHandle: string | null;
  followers: number | null;
  mediaCount: number | null;
  bio: string | null;
  profilePic: string | null;
  accessToken: string;
  emailHint?: string | null;
}

/**
 * Find-or-create a user by their Instagram Business account id. The Instagram
 * user id is stable for the lifetime of the IG account, so it's the right
 * primary key. When the user has already signed in another way (e.g. Google
 * first) we'd ideally merge — for now, we treat IG and Google sign-ins as
 * separate accounts unless the same row gets matched by IG user id.
 */
export async function signInWithInstagram(args: InstagramSignInArgs): Promise<UpsertResult> {
  const existing = await prisma.user.findFirst({
    where: { instagramUserId: args.instagramUserId },
  });
  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        instagramAccessToken: args.accessToken,
        instagramHandle: args.instagramHandle,
        instagramFollowers: args.followers,
        instagramMediaCount: args.mediaCount,
        instagramBio: args.bio,
        instagramProfilePic: args.profilePic,
        instagramConnectedAt: new Date(),
      },
    });
    return { user: updated, isNewUser: false };
  }

  // Fresh signup. Email is a "best guess" — IG doesn't give us one, so we
  // synthesize a stable, unique placeholder per IG user id. The user can edit
  // it from Settings later. Org is named after the handle when we have one.
  const synthEmail =
    (args.emailHint?.trim() ||
      `${args.instagramHandle?.replace(/^@/, '') ?? args.instagramUserId}@instagram.illuminati`).toLowerCase();
  const handle = args.instagramHandle?.replace(/^@/, '') ?? 'creator';
  const created = await prisma.user.create({
    data: {
      email: synthEmail,
      providerName: 'LOCAL',
      timezone: 0,
      name: handle,
      userMode: 'CREATOR',
      instagramUserId: args.instagramUserId,
      instagramAccessToken: args.accessToken,
      instagramHandle: args.instagramHandle,
      instagramFollowers: args.followers,
      instagramMediaCount: args.mediaCount,
      instagramBio: args.bio,
      instagramProfilePic: args.profilePic,
      instagramConnectedAt: new Date(),
      organizations: {
        create: {
          role: 'SUPERADMIN',
          organization: { create: { name: `${handle}'s studio` } },
        },
      },
    },
  });
  return { user: created, isNewUser: true };
}

interface GoogleSignInArgs {
  googleEmail: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
}

/**
 * Find-or-create a user by their Google email. We also accept a JWT-attached
 * incoming user (when Google is being added as a secondary connection to an
 * already-logged-in IG account) — in that case we update the live user in
 * place instead of creating a duplicate.
 */
export async function signInWithGoogle(
  args: GoogleSignInArgs,
  currentUserId?: string | null
): Promise<UpsertResult> {
  // If someone is already signed in (e.g. via IG), attach Google to their
  // existing account rather than spawning a new user.
  if (currentUserId) {
    const existing = await prisma.user.findUnique({ where: { id: currentUserId } });
    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          googleAccessToken: args.accessToken,
          ...(args.refreshToken ? { googleRefreshToken: args.refreshToken } : {}),
          googleExpiresAt: args.expiresIn
            ? new Date(Date.now() + args.expiresIn * 1000)
            : null,
          googleEmail: args.googleEmail,
          googleConnectedAt: new Date(),
        },
      });
      return { user: updated, isNewUser: false };
    }
  }

  const existing = await prisma.user.findFirst({
    where: { googleEmail: args.googleEmail },
  });
  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        googleAccessToken: args.accessToken,
        ...(args.refreshToken ? { googleRefreshToken: args.refreshToken } : {}),
        googleExpiresAt: args.expiresIn
          ? new Date(Date.now() + args.expiresIn * 1000)
          : null,
        googleConnectedAt: new Date(),
      },
    });
    return { user: updated, isNewUser: false };
  }

  const created = await prisma.user.create({
    data: {
      email: args.googleEmail.toLowerCase(),
      providerName: 'GOOGLE',
      timezone: 0,
      googleEmail: args.googleEmail,
      googleAccessToken: args.accessToken,
      ...(args.refreshToken ? { googleRefreshToken: args.refreshToken } : {}),
      googleExpiresAt: args.expiresIn
        ? new Date(Date.now() + args.expiresIn * 1000)
        : null,
      googleConnectedAt: new Date(),
      userMode: 'MANAGER',
      organizations: {
        create: {
          role: 'SUPERADMIN',
          organization: { create: { name: 'My workspace' } },
        },
      },
    },
  });
  return { user: created, isNewUser: true };
}

/**
 * Returns the current user id from the JWT cookie WITHOUT throwing — used by
 * OAuth callbacks that want to attach a provider to an existing session
 * (when present) instead of always creating a new user.
 */
export async function readCurrentUserIdSilent(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const decoded = verifyJWT(token);
  return decoded?.id ?? null;
}
