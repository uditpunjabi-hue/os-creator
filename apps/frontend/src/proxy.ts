import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';
import { internalFetch } from '@gitroom/helpers/utils/internal.fetch';
import acceptLanguage from 'accept-language';
import {
  cookieName,
  headerName,
  languages,
} from '@gitroom/react/translation/i18n.config';
acceptLanguage.languages(languages);

// ---------------------------------------------------------------------------
// Auth-gate prefixes. Anything under these prefixes is reachable without an
// auth cookie — every other page navigation forces a redirect to
// /auth/login. The matcher below already excludes /api/* so we don't need
// to whitelist API routes here; server-side route handlers do their own
// JWT checks via getAuth() and throw 401 directly.
// ---------------------------------------------------------------------------
const PUBLIC_PREFIXES = [
  '/auth',
  '/onboarding',
  '/p/',
  '/provider/',
  '/uploads/',
  '/integrations/social/',
];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  for (const p of PUBLIC_PREFIXES) {
    if (pathname === p || pathname.startsWith(p + (p.endsWith('/') ? '' : '/'))) {
      return true;
    }
    if (p.endsWith('/') && pathname.startsWith(p)) return true;
  }
  return false;
}

// This function can be marked `async` if using `await` inside
export async function proxy(request: NextRequest) {
  const nextUrl = request.nextUrl;
  const authCookie =
    request.cookies.get('auth') ||
    request.headers.get('auth') ||
    nextUrl.searchParams.get('loggedAuth');
  const lng = request.cookies.has(cookieName)
    ? acceptLanguage.get(request.cookies.get(cookieName).value)
    : acceptLanguage.get(
        request.headers.get('Accept-Language') ||
          request.headers.get('accept-language')
      );

  const requestHeaders = new Headers(request.headers);
  if (lng) {
    requestHeaders.set(headerName, lng);
  }

  const topResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (lng) {
    topResponse.headers.set(cookieName, lng);
  }

  if (nextUrl.pathname.startsWith('/modal/') && !authCookie) {
    return NextResponse.redirect(new URL(`/auth/login-required`, nextUrl.href));
  }

  if (
    nextUrl.pathname.startsWith('/uploads/') ||
    nextUrl.pathname.startsWith('/p/') ||
    nextUrl.pathname.startsWith('/provider/') ||
    nextUrl.pathname.startsWith('/icons/')
  ) {
    return topResponse;
  }

  if (
    nextUrl.pathname.startsWith('/integrations/social/') &&
    nextUrl.href.indexOf('state=login') === -1
  ) {
    return topResponse;
  }

  // If the URL is logout, delete the cookie and redirect to login
  if (nextUrl.href.indexOf('/auth/logout') > -1) {
    const response = NextResponse.redirect(
      new URL('/auth/login', nextUrl.href)
    );
    response.cookies.set('auth', '', {
      path: '/',
      ...(!process.env.NOT_SECURED
        ? {
            secure: true,
            httpOnly: true,
            sameSite: false,
          }
        : {}),
      maxAge: -1,
      domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
    });
    return response;
  }

  if (
    nextUrl.pathname.startsWith('/auth/register') &&
    process.env.DISABLE_REGISTRATION === 'true'
  ) {
    return NextResponse.redirect(new URL('/auth/login', nextUrl.href));
  }

  // Already signed in but bouncing through /auth/login → straight to app.
  // Honoured ?stay=1 (the stale-cookie redirect uses this to avoid the
  // bounce-back loop) and ?error= (so OAuth failures still display).
  if (
    authCookie &&
    nextUrl.pathname === '/auth/login' &&
    !nextUrl.searchParams.get('error') &&
    !nextUrl.searchParams.get('stay')
  ) {
    return NextResponse.redirect(
      new URL('/creator/research/profile', nextUrl.href)
    );
  }

  const org = nextUrl.searchParams.get('org');

  // /auth/* is now the canonical entry: render the Illuminati OAuth landing.
  // (Previously this proxy short-circuited all /auth visits to / for a dev
  // hardcoded-user bypass — removed so the new login flow is reachable.)
  try {
    if (org) {
      const { id } = await (
        await internalFetch('/user/join-org', {
          body: JSON.stringify({
            org,
          }),
          method: 'POST',
        })
      ).json();
      const redirect = NextResponse.redirect(
        new URL(`/?added=true`, nextUrl.href)
      );
      if (id) {
        redirect.cookies.set('showorg', id, {
          ...(!process.env.NOT_SECURED
            ? {
                path: '/',
                secure: true,
                httpOnly: true,
                sameSite: false,
                domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
              }
            : {}),
          expires: new Date(Date.now() + 15 * 60 * 1000),
        });
      }
      return redirect;
    }
    if (nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL(`/home`, nextUrl.href));
    }

    // Auth-gate for every page that isn't explicitly public. Unauthenticated
    // browsers go to /auth/login with the original destination preserved so
    // we can bounce them back after sign-in.
    if (!authCookie && !isPublicPath(nextUrl.pathname)) {
      const loginUrl = new URL('/auth/login', nextUrl.href);
      loginUrl.searchParams.set('next', nextUrl.pathname + nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    return topResponse;
  } catch (err) {
    console.log('err', err);
    return NextResponse.redirect(new URL('/auth/logout', nextUrl.href));
  }
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/((?!api/|_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)',
};
