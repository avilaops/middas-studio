import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { apiKey } = await req.json();
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ ok: false, error: 'apiKey is required' }, { status: 400 });
    }
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json({ ok: false, status: r.status, error: text }, { status: 200 });
    }
    const j = await r.json();
    return NextResponse.json({
      ok: true,
      models_count: Array.isArray(j.data) ? j.data.length : 0,
      sample: Array.isArray(j.data) ? j.data.slice(0, 3).map((m: any) => m.id) : [],
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
