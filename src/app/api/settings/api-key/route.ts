import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { GROQ_COOKIE_NAME } from '@/lib/groq';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mask(key: string) {
  if (!key) return '';
  if (key.length <= 8) return '***';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

export async function GET() {
  const c = cookies().get(GROQ_COOKIE_NAME);
  return NextResponse.json({
    hasKey: !!c?.value,
    masked: c?.value ? mask(c.value) : null,
    source: c?.value ? 'cookie' : (process.env.GROQ_API_KEY ? 'env' : 'none'),
  });
}

export async function POST(req: Request) {
  try {
    const { apiKey } = await req.json();
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ ok: false, error: 'apiKey is required' }, { status: 400 });
    }
    cookies().set(GROQ_COOKIE_NAME, apiKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
    return NextResponse.json({ ok: true, masked: mask(apiKey) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE() {
  cookies().delete(GROQ_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
