import 'server-only';
import type { NextResponse } from 'next/server';
import { signJWT } from './auth';
import { prisma } from './prisma';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Mint a JWT and attach it to a redirect/response as the `auth` cookie. Honors
 * NOT_SECURED so http://localhost dev doesn't drop the cookie. Matches the
 * NestJS cookie shape exactly so middleware reads it identically.
 */
export async function signInUser(res: NextResponse, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const jwt = signJWT({ id: user.id, email: user.email });
  const secured = !process.env.NOT_SECURED;
  res.cookies.set('auth', jwt, {
    path: '/',
    httpOnly: secured,
    secure: secured,
    sameSite: secured ? 'none' : 'lax',
    maxAge: ONE_YEAR_SECONDS,
  });
}

export function frontendUrl(path: string): string {
  const base = process.env.FRONTEND_URL ?? 'http://localhost:4200';
  return `${base.replace(/\/$/, '')}${path}`;
}

export function backendBase(): string {
  // Where Google/Meta should send the OAuth callback. Now points at the
  // same origin as the frontend since the callbacks live in Next.js routes.
  return (
    process.env.OAUTH_REDIRECT_BASE ??
    process.env.FRONTEND_URL ??
    'http://localhost:4200'
  ).replace(/\/$/, '');
}
