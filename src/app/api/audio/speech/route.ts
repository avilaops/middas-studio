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
      input,
      model = 'playai-tts',
      voice = 'Fritz-PlayAI',
      response_format = 'wav',
      speed = 1,
    } = body;

    if (!input) return NextResponse.json({ error: 'input is required' }, { status: 400 });

    const speech = await (groq.audio as any).speech.create({
      model,
      voice,
      input,
      response_format,
      speed,
    } as any);

    const buffer = Buffer.from(await speech.arrayBuffer());
    const duration = Date.now() - start;

    await query(
      `INSERT INTO audio_jobs (type, model, output_text, duration_ms, metadata)
       VALUES ('tts',$1,$2,$3,$4)`,
      [model, input.slice(0, 500), duration, JSON.stringify({ voice, response_format, speed })]
    );

    await logApi({ module: 'audio', endpoint: '/audio/speech', model, status_code: 200, duration_ms: duration });

    const mime = response_format === 'mp3' ? 'audio/mpeg'
      : response_format === 'flac' ? 'audio/flac'
      : response_format === 'mulaw' ? 'audio/basic'
      : response_format === 'ogg' ? 'audio/ogg'
      : 'audio/wav';

    return new Response(buffer as any, {
      headers: {
        'Content-Type': mime,
        'X-Duration-Ms': String(duration),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
