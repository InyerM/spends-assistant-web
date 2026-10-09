import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { env } from './lib/env';
import { defaultLocale, isValidLocale } from './i18n/config';
import { needsEligibilityAttestation } from './lib/auth/eligibility';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/auth'];
const MOBILE_BEARER_ROUTES: Record<string, readonly string[]> = {
  '/api/api-keys': ['GET', 'POST', 'DELETE'],
  '/api/settings/sessions': ['GET'],
  '/api/settings/user-settings': ['GET', 'PATCH'],
  '/api/settings/account/delete': ['POST'],
  '/api/merchant-suggestions': ['POST'],
};

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * Reads the locale from the request cookie, defaulting to 'es' (Colombia).
 * Sets the cookie on the response if it was missing or invalid.
 */
function ensureLocaleCookie(request: NextRequest, response: NextResponse): void {
  const cookieLocale = request.cookies.get('locale')?.value;

  if (!isValidLocale(cookieLocale)) {
    response.cookies.set('locale', defaultLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    });
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  if (
    request.headers.has('authorization') &&
    Object.hasOwn(MOBILE_BEARER_ROUTES, pathname) &&
    MOBILE_BEARER_ROUTES[pathname].includes(request.method)
  ) {
    return NextResponse.next({ request });
  }

  // The Shortcut inbox handler validates bearer API keys without a browser session.
  if (
    pathname === '/api/shortcut-inbox' &&
    request.method === 'POST' &&
    request.headers.has('authorization')
  ) {
    return NextResponse.next({ request });
  }

  // Document API handlers verify mobile bearer tokens and enforce user-scoped access.
  if (
    (pathname === '/api/documents' || pathname.startsWith('/api/documents/')) &&
    request.headers.has('authorization')
  ) {
    return NextResponse.next({ request });
  }

  // The owner-scoped transaction writer verifies mobile bearer tokens itself.
  if (
    pathname === '/api/transactions' &&
    request.method === 'POST' &&
    request.headers.has('authorization')
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll(): ReturnType<typeof request.cookies.getAll> {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options: Parameters<typeof supabaseResponse.cookies.set>[2];
          }>,
        ): void {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session — this is critical to keep cookies in sync
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && needsEligibilityAttestation(user) && pathname !== '/auth/callback') {
    if (
      pathname !== '/eligibility' &&
      pathname !== '/api/settings/account/delete' &&
      pathname !== '/api/legal/acceptance'
    ) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Eligibility confirmation required' }, { status: 403 });
      }
      const url = request.nextUrl.clone();
      url.pathname = '/eligibility';
      url.search = '';
      return NextResponse.redirect(url);
    }
  } else if (user && pathname === '/eligibility') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (
    user &&
    isPublicPath(pathname) &&
    pathname !== '/auth/recovery' &&
    pathname !== '/auth/callback'
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Ensure locale cookie is set on every response
  ensureLocaleCookie(request, supabaseResponse);

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
