import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';
import { logApi } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Pipeline: STT (whisper) → LLM (chat) → TTS (playai)
export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const formData = await req.formData();
    const audio = formData.get('audio') as File;
    const sttModel = (formData.get('stt_model') as string) || 'whisper-large-v3-turbo';
    const llmModel = (formData.get('llm_model') as string) || 'llama-3.3-70b-versatile';
    const ttsModel = (formData.get('tts_model') as string) || 'playai-tts';
    const voice = (formData.get('voice') as string) || 'Fritz-PlayAI';
    const systemPrompt = (formData.get('system') as string) || 'You are a concise voice assistant. Keep replies short.';
    const language = (formData.get('language') as string) || undefined;

    if (!audio) return NextResponse.json({ error: 'audio required' }, { status: 400 });

    // 1. STT
    const sttStart = Date.now();
    const transcription: any = await groq.audio.transcriptions.create({
      file: audio as any,
      model: sttModel,
      language: language as any,
      response_format: 'json',
    });
    const userText = transcription.text || '';
    const sttMs = Date.now() - sttStart;

    // 2. LLM
    const llmStart = Date.now();
    const completion = await groq.chat.completions.create({
      model: llmModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
      max_tokens: 512,
    });
    const reply = completion.choices[0]?.message?.content || '';
    const llmMs = Date.now() - llmStart;

    // 3. TTS
    const ttsStart = Date.now();
    const speech = await (groq.audio as any).speech.create({
      model: ttsModel,
      voice,
      input: reply,
      response_format: 'wav',
    } as any);
    const audioBuf = Buffer.from(await speech.arrayBuffer());
    const ttsMs = Date.now() - ttsStart;

    const duration = Date.now() - start;
    await logApi({
      module: 's2s',
      endpoint: '/s2s',
      model: `${sttModel}|${llmModel}|${ttsModel}`,
      status_code: 200,
      duration_ms: duration,
    });

    return NextResponse.json({
      user_text: userText,
      reply_text: reply,
      audio_base64: audioBuf.toString('base64'),
      audio_mime: 'audio/wav',
      timings: { stt_ms: sttMs, llm_ms: llmMs, tts_ms: ttsMs, total_ms: duration },
      usage: completion.usage,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
