import { NextRequest, NextResponse } from 'next/server';

// Simple bearer-token auth (set APP_AUTH_TOKEN in env to enable).
// Plus per-IP token bucket rate limit on /api/* routes.

const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_MIN || 60);

export function middleware(req: NextRequest) {
  const url = req.nextUrl.pathname;
  if (!url.startsWith('/api')) return NextResponse.next();

  // Auth (optional) — only enforced if APP_AUTH_TOKEN is set
  const requiredToken = process.env.APP_AUTH_TOKEN;
  if (requiredToken) {
    const auth = req.headers.get('authorization') || req.cookies.get('auth')?.value || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (token !== requiredToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'local';
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    bucket.count++;
    if (bucket.count > MAX_PER_WINDOW) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retry_after_ms: bucket.resetAt - now },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((bucket.resetAt - now) / 1000)) } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
