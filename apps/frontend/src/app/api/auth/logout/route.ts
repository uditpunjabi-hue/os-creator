import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Clears the auth + org cookies so the next request lands on /auth/login.
 * Both the cookie clear and the explicit `auth-cleared` header are returned
 * so client-side cookie readers (used in non-secured dev mode) can flush
 * their local copies too.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Empty value + maxAge=0 deletes the cookie regardless of how it was set
  // (httpOnly or not, secure or not). Mirroring across both SameSite modes
  // covers the prod and dev cookie shapes.
  const expire = (name: string) => {
    res.cookies.set(name, '', { path: '/', maxAge: 0 });
  };
  expire('auth');
  expire('showorg');
  expire('impersonate');
  res.headers.set('x-auth-cleared', '1');
  return res;
}
