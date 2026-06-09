import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';
import { logApi } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Compound = sistema agentic da Groq com web search + code execution embutidos
// Modelos: compound-beta, compound-beta-mini
export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const {
      model = 'compound-beta',
      messages,
      temperature = 0.7,
      max_tokens = 2048,
      exclude_domains,
      include_domains,
    } = await req.json();

    const completion = await groq.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
      // @ts-ignore — compound-specific
      ...(exclude_domains || include_domains
        ? {
            search_settings: {
              exclude_domains: exclude_domains || undefined,
              include_domains: include_domains || undefined,
            },
          }
        : {}),
    } as any);

    const duration = Date.now() - start;
    await logApi({ module: 'compound', endpoint: '/compound', model, status_code: 200, duration_ms: duration });
    return NextResponse.json({ ...completion, duration_ms: duration });
  } catch (e: any) {
    await logApi({ module: 'compound', endpoint: '/compound', error: e.message, status_code: 500 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
