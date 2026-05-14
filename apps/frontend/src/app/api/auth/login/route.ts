import { NextRequest, NextResponse } from 'next/server';
import { compareSync } from 'bcrypt';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { signJWT } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

interface LoginBody {
  email?: string;
  password?: string;
  provider?: string;
}

/**
 * Email/password login. Mints the auth cookie and returns { login: true }.
 * OAuth providers (GOOGLE/META) go through their own /api/oauth callbacks
 * instead and don't hit this endpoint.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as LoginBody;
  if (!body.email) return errorResponse(400, 'email required');
  if (!body.password) return errorResponse(400, 'password required');

  const user = await prisma.user.findFirst({
    where: { email: body.email.toLowerCase(), providerName: 'LOCAL' },
  });
  if (!user || !user.password) return errorResponse(401, 'Invalid credentials');

  const ok = compareSync(body.password, user.password);
  if (!ok) return errorResponse(401, 'Invalid credentials');

  const jwt = signJWT({ id: user.id, email: user.email });
  const secured = !process.env.NOT_SECURED;
  const res = NextResponse.json(
    { login: true },
    { headers: { reload: 'true', ...(process.env.NOT_SECURED ? { auth: jwt } : {}) } }
  );
  res.cookies.set('auth', jwt, {
    path: '/',
    httpOnly: secured,
    secure: secured,
    sameSite: secured ? 'none' : 'lax',
    maxAge: ONE_YEAR_SECONDS,
  });
  return res;
});
