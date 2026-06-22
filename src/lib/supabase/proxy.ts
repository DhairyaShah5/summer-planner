import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';

const VIEW_COOKIE = 'view_mode';
const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/auth');

  if (user) {
    // Authenticated owner — ensure any stale view_mode cookie is cleared so
    // they see the editable UI, not the viewer banner.
    if (request.cookies.get(VIEW_COOKIE)) {
      request.cookies.delete(VIEW_COOKIE);
      supabaseResponse = NextResponse.next({ request });
      supabaseResponse.cookies.delete(VIEW_COOKIE);
    }
    return supabaseResponse;
  }

  if (!isAuthRoute) {
    // Anonymous visitor on a real page — drop them into read-only view mode
    // instead of redirecting to /login. Set the cookie on BOTH the request
    // and the response so the current render sees it via `cookies()`.
    request.cookies.set(VIEW_COOKIE, '1');
    supabaseResponse = NextResponse.next({ request });
    supabaseResponse.cookies.set(VIEW_COOKIE, '1', {
      maxAge: VIEW_COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
    });
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so: NextResponse.next({ request })
  // 2. Copy over the cookies
  // 3. Change the response object to fit your needs, but avoid changing the cookies!
  return supabaseResponse;
}
