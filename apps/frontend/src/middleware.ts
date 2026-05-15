import { NextResponse, type NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Edge middleware — runs ahead of every page + API route. We only enforce
// two rules:
//   1. Browser navigations to protected app routes (e.g. /creator, /manager)
//      require an `auth` cookie. No cookie → redirect to /auth/login.
//   2. Visiting /auth/login while already signed in bounces to the dashboard.
//
// The auth cookie is opaque at the edge (Edge runtime can't import
// jsonwebtoken / Prisma). Server route handlers still verify the JWT and
// throw 401 on tamper — middleware is just the "looks logged in" check, not
// the authoritative one. That's enough to keep public traffic out of the
// app shell without leaking it via flash-of-unauthenticated-UI.
// ---------------------------------------------------------------------------

const PUBLIC_PREFIXES = [
  '/auth',
  '/api/oauth',
  '/api/auth',
  '/api/connections', // used by the login page to check status before signin
  '/onboarding',
];

const PUBLIC_EXACT = new Set([
  '/',
  '/favicon.ico',
  '/manifest.json',
  '/illuminati-logo.png',
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/icons/')) return true;
  if (pathname.startsWith('/assets/')) return true;
  if (pathname.startsWith('/_vercel/')) return true;
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return true;
  }
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasAuth = !!req.cookies.get('auth')?.value;

  // Already signed in but bouncing through /auth/login → straight to app.
  // The IG `?stay=1` and any error params are honoured (so the user can
  // see why the OAuth attempt failed).
  if (
    hasAuth &&
    pathname === '/auth/login' &&
    !req.nextUrl.searchParams.get('error') &&
    !req.nextUrl.searchParams.get('stay')
  ) {
    return NextResponse.redirect(new URL('/creator/research/profile', req.url));
  }

  if (isPublic(pathname)) return NextResponse.next();
  if (hasAuth) return NextResponse.next();

  // API call without auth → return 401 so SWR/useFetch surfaces an error
  // (the client layout will redirect to /auth/login on 401).
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { statusCode: 401, message: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Browser navigation → redirect to login, preserving the destination so
  // we can bounce back after sign-in.
  const url = new URL('/auth/login', req.url);
  if (pathname !== '/auth/login') {
    url.searchParams.set('next', pathname + (search || ''));
  }
  return NextResponse.redirect(url);
}

// Skip middleware for static assets and the public favicon. The matcher uses
// negative lookahead to avoid running on _next, images, and the manifest.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|illuminati-logo.png|manifest.json).*)'],
};
