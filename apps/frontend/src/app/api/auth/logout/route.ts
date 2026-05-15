import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Clears the auth + org cookies so the next request lands on /auth/login.
 *
 * Browsers only delete a cookie when the `Set-Cookie` header on the delete
 * request matches the flags the cookie was originally written with. Our
 * sign-in path uses `{ httpOnly, secure, sameSite: 'none' }` in production
 * and `{ sameSite: 'lax' }` in dev — so we set BOTH variants here. The
 * mismatched one is a no-op; the matched one wins.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  const secured = !process.env.NOT_SECURED;
  const expire = (name: string) => {
    // Primary path matches what we wrote at sign-in.
    res.cookies.set(name, '', {
      path: '/',
      maxAge: 0,
      httpOnly: secured,
      secure: secured,
      sameSite: secured ? 'none' : 'lax',
    });
    // Belt + suspenders: also send a plain cookie in case the original was
    // written before the secured flag was flipped (e.g. an old build).
    res.cookies.set(name, '', { path: '/', maxAge: 0 });
  };
  expire('auth');
  expire('showorg');
  expire('impersonate');
  res.headers.set('x-auth-cleared', '1');
  return res;
}
