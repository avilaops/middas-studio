import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';
import { logApi } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Embeddings — Groq currently doesn't expose this on its main inference endpoint,
// but Nomic models are routed through compatible OpenAI-style endpoint.
// Falls back gracefully if unavailable.
export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const { input, model = 'nomic-embed-text-v1.5' } = await req.json();
    if (!input) return NextResponse.json({ error: 'input required' }, { status: 400 });

    let result: any;
    try {
      result = await (groq as any).embeddings.create({
        model,
        input: Array.isArray(input) ? input : [input],
      });
    } catch (e: any) {
      return NextResponse.json({
        error: `Embeddings not available on this Groq account/SDK version: ${e.message}`,
        hint: 'Enable embeddings in your Groq dashboard or use OpenAI-compatible alternative.',
      }, { status: 501 });
    }

    const duration = Date.now() - start;
    await logApi({ module: 'embeddings', endpoint: '/embeddings', model, status_code: 200, duration_ms: duration });
    return NextResponse.json({ ...result, duration_ms: duration });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
