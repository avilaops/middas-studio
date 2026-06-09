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
    const model = (formData.get('model') as string) || 'whisper-large-v3-turbo';
    const language = (formData.get('language') as string) || undefined;
    const prompt = (formData.get('prompt') as string) || undefined;
    const response_format = (formData.get('response_format') as string) || 'verbose_json';
    const temperature = Number(formData.get('temperature') || 0);

    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

    const transcription = await groq.audio.transcriptions.create({
      file: file as any,
      model,
      language: language as any,
      prompt,
      response_format: response_format as any,
      temperature,
    });

    const duration = Date.now() - start;
    await query(
      `INSERT INTO audio_jobs (type, model, input_filename, output_text, language, duration_ms, metadata)
       VALUES ('transcription',$1,$2,$3,$4,$5,$6)`,
      [
        model,
        (file as any).name || 'audio',
        (transcription as any).text || '',
        language || null,
        duration,
        JSON.stringify(transcription),
      ]
    );

    await logApi({ module: 'audio', endpoint: '/audio/transcriptions', model, status_code: 200, duration_ms: duration });
    return NextResponse.json({ ...transcription, duration_ms: duration });
  } catch (e: any) {
    await logApi({ module: 'audio', endpoint: '/audio/transcriptions', error: e.message, status_code: 500 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
