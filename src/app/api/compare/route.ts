import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';
import { logApi } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Run the same prompt against multiple models in parallel for comparison.
export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const {
      models = [],
      prompt,
      system = 'You are a helpful assistant.',
      temperature = 0.7,
      max_tokens = 1024,
    } = await req.json();

    if (!Array.isArray(models) || models.length === 0) {
      return NextResponse.json({ error: 'models[] required' }, { status: 400 });
    }
    if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 });

    const runs = await Promise.all(
      models.map(async (model: string) => {
        const t0 = Date.now();
        try {
          const completion = await groq.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ],
            temperature,
            max_tokens,
          });
          return {
            model,
            ok: true,
            text: completion.choices[0]?.message?.content || '',
            usage: completion.usage,
            latency_ms: Date.now() - t0,
          };
        } catch (e: any) {
          return { model, ok: false, error: e.message, latency_ms: Date.now() - t0 };
        }
      })
    );

    const duration = Date.now() - start;
    await logApi({
      module: 'compare',
      endpoint: '/compare',
      model: models.join(','),
      status_code: 200,
      duration_ms: duration,
    });

    return NextResponse.json({ runs, total_duration_ms: duration });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
