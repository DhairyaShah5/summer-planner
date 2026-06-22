import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

const VIEW_COOKIE = 'view_mode';
const VIEW_TOKEN_PARAM = 'view';
// Long-lived viewer cookie; rotate VIEW_TOKEN env var to revoke outstanding viewers.
const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const tokenParam = url.searchParams.get(VIEW_TOKEN_PARAM);

  if (tokenParam != null) {
    const expected = process.env.VIEW_TOKEN;
    const cleanUrl = url.clone();
    cleanUrl.searchParams.delete(VIEW_TOKEN_PARAM);
    const response = NextResponse.redirect(cleanUrl);
    if (expected && tokenParam === expected) {
      response.cookies.set(VIEW_COOKIE, '1', {
        maxAge: VIEW_COOKIE_MAX_AGE,
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
      });
    }
    return response;
  }

  // If a valid view-mode cookie is present, skip Supabase auth gating entirely.
  if (request.cookies.get(VIEW_COOKIE)?.value === '1') {
    return NextResponse.next({ request });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, fonts, and other static assets
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|images|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)',
  ],
};
