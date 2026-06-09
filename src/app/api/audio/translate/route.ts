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
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const model = (formData.get('model') as string) || 'whisper-large-v3';
    const prompt = (formData.get('prompt') as string) || undefined;
    const response_format = (formData.get('response_format') as string) || 'verbose_json';
    const temperature = Number(formData.get('temperature') || 0);

    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

    const translation = await groq.audio.translations.create({
      file: file as any,
      model,
      prompt,
      response_format: response_format as any,
      temperature,
    });

    const duration = Date.now() - start;
    await query(
      `INSERT INTO audio_jobs (type, model, input_filename, output_text, duration_ms, metadata)
       VALUES ('translation',$1,$2,$3,$4,$5)`,
      [model, (file as any).name || 'audio', (translation as any).text || '', duration, JSON.stringify(translation)]
    );

    await logApi({ module: 'audio', endpoint: '/audio/translations', model, status_code: 200, duration_ms: duration });
    return NextResponse.json({ ...translation, duration_ms: duration });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
