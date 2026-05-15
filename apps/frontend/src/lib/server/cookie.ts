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

/**
 * Build a fully-qualified frontend URL. Prefers env vars; falls back to the
 * incoming request's origin so an unset Vercel env doesn't trap users with
 * localhost redirects.
 */
export function frontendUrl(path: string, req?: Request): string {
  const base =
    process.env.FRONTEND_URL ??
    (req ? new URL(req.url).origin : undefined) ??
    'http://localhost:4200';
  return `${base.replace(/\/$/, '')}${path}`;
}

/**
 * Where Google/Meta redirect after the OAuth dance. The callbacks live at
 * /api/oauth/*\/callback on the same origin as the frontend.
 *
 * Resolution: OAUTH_REDIRECT_BASE → FRONTEND_URL → request origin → localhost.
 * The request-origin fallback means Vercel deploys still work even if the
 * user forgets to set either env var.
 *
 * In production we additionally REJECT anything that resolves to localhost /
 * 127.0.0.1 — Facebook will refuse it, the resulting bounce would be a
 * confusing "Invalid redirect URI" without obvious cause. Fail-loud lets the
 * operator notice missing FRONTEND_URL on deploy.
 */
export function backendBase(req?: Request): string {
  const computed = (
    process.env.OAUTH_REDIRECT_BASE ??
    process.env.FRONTEND_URL ??
    (req ? new URL(req.url).origin : undefined) ??
    'http://localhost:4200'
  ).replace(/\/$/, '');

  if (process.env.NODE_ENV === 'production') {
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(computed)) {
      throw new Error(
        `OAuth redirect base resolved to "${computed}" in production. Set FRONTEND_URL to your public origin (e.g. https://os-creator.vercel.app) in Vercel env vars.`
      );
    }
  }
  return computed;
}
