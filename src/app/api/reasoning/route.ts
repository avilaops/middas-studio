import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';
import { logApi } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const {
      model = 'deepseek-r1-distill-llama-70b',
      prompt,
      messages,
      max_tokens = 2048,
      temperature = 0.6,
      reasoning_format = 'parsed',
    } = await req.json();

    const msgs = messages || [{ role: 'user', content: prompt }];

    const completion = await groq.chat.completions.create({
      model,
      messages: msgs,
      max_tokens,
      temperature,
      reasoning_format,
    } as any);

    const duration = Date.now() - start;
    await logApi({ module: 'reasoning', endpoint: '/reasoning', model, status_code: 200, duration_ms: duration });
    return NextResponse.json({ ...completion, duration_ms: duration });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
