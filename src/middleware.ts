import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySession } from '@/lib/adminAuth';

// Routes that are accessible without an admin session
const PUBLIC_PATHS = ['/admin/login', '/api/admin/login', '/api/admin/logout'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let public paths through
  if (PUBLIC_PATHS.some((p) => pathname === p)) {
    return NextResponse.next();
  }

  // Protect all /admin and /api/admin routes
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const authenticated = cookie ? await verifySession(cookie) : false;

  if (!authenticated) {
    // API routes return 401
    if (pathname.startsWith('/api/admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Page routes redirect to login
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
