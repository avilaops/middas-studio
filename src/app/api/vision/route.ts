import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';
import { ensureSchema, query } from '@/lib/db';
import { logApi } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await ensureSchema();
  const start = Date.now();
  try {
    const body = await req.json();
    const {
      model = 'llama-3.2-11b-vision-preview',
      prompt = 'Describe this image in detail.',
      image_url,
      image_base64,
      max_tokens = 1024,
      temperature = 0.7,
    } = body;

    if (!image_url && !image_base64) {
      return NextResponse.json({ error: 'image_url or image_base64 required' }, { status: 400 });
    }

    const url = image_url || `data:image/jpeg;base64,${image_base64}`;

    const completion = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url } },
          ] as any,
        },
      ],
      max_tokens,
      temperature,
    });

    const duration = Date.now() - start;
    const text = completion.choices[0]?.message?.content || '';

    await query(
      `INSERT INTO vision_requests (model, prompt, image_url, response, duration_ms)
       VALUES ($1,$2,$3,$4,$5)`,
      [model, prompt, image_url || '(base64)', text, duration]
    );

    await logApi({ module: 'vision', endpoint: '/vision', model, status_code: 200, duration_ms: duration });
    return NextResponse.json({ ...completion, duration_ms: duration });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
