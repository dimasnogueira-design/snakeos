import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass || pass.length<12) return new NextResponse('Admin credentials not configured', { status: 503 });

  const header = req.headers.get('authorization');
  if (header?.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(':');
      if (sep >= 0 && decoded.slice(0, sep) === user && decoded.slice(sep + 1) === pass) return NextResponse.next();
    } catch {}
  }
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="SNAKE CONTROL"' }
  });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|offline.html|sw.js|icon.svg|icon-192.png|icon-512.png|manifest.webmanifest).*)'] };
