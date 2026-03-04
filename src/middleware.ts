import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'site_access';

async function getExpectedCookieValue(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode('site_access_verified')
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(req: NextRequest) {
  const password = process.env.SITE_ACCESS_PASSWORD;
  if (!password) {
    return NextResponse.next();
  }

  const path = req.nextUrl.pathname;
  if (path === '/gate' || path.startsWith('/api/gate') || path.startsWith('/_next') || path.startsWith('/favicon')) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const expected = await getExpectedCookieValue(password);

  if (cookie === expected) {
    return NextResponse.next();
  }

  const gateUrl = new URL('/gate', req.url);
  gateUrl.searchParams.set('next', path);
  return NextResponse.redirect(gateUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
