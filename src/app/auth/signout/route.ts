import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // Block cross-site sign-out CSRF. Same-site + same-origin browsers set
  // Sec-Fetch-Site; requests missing it (curl, older browsers) are allowed.
  const sfs = request.headers.get('sec-fetch-site');
  if (sfs && sfs !== 'same-origin' && sfs !== 'same-site' && sfs !== 'none') {
    return new NextResponse('Forbidden', { status: 403 });
  }
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
