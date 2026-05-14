import { NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async () => {
  const { user, org } = await getAuth();
  // Strip the password field before returning — matches the NestJS auth
  // middleware's req.user shape.
  const { password: _pw, ...safe } = user as typeof user & { password?: string | null };
  return NextResponse.json({ user: safe, org });
});
