import { NextRequest, NextResponse } from 'next/server';
import { runJarvis, JARVIS_SYSTEM_PROMPT } from '@/lib/jarvis/agent';
import { JARVIS_TOOLS } from '@/lib/jarvis/tools';
import { logApi } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await req.json();
    const {
      task,
      messages,
      model,
      max_iterations,
      allowed_tools,
      system_prompt,
    } = body;

    if (!task && !messages) {
      return NextResponse.json({ error: 'task or messages required' }, { status: 400 });
    }

    const history = messages ? messages.filter((m: any) => m.role !== 'system') : [];
    const userTask =
      task ||
      [...history].reverse().find((m: any) => m.role === 'user')?.content ||
      '';
    const priorHistory = task ? history : history.slice(0, -1);

    const result = await runJarvis({
      task: userTask,
      model,
      maxIterations: max_iterations,
      allowedTools: allowed_tools,
      systemPrompt: system_prompt,
      history: priorHistory,
    });

    await logApi({
      module: 'jarvis',
      endpoint: '/jarvis',
      model: model || 'llama-3.3-70b-versatile',
      status_code: result.ok ? 200 : 500,
      duration_ms: Date.now() - start,
      error: result.error,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    const msg = e?.message || e?.toString?.() || String(e) || 'unknown error';
    console.error('[jarvis] POST error:', e);
    await logApi({
      module: 'jarvis',
      endpoint: '/jarvis',
      status_code: 500,
      duration_ms: Date.now() - start,
      error: msg,
    });
    return NextResponse.json({ error: msg, stack: e?.stack }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    system_prompt: JARVIS_SYSTEM_PROMPT,
    tools: JARVIS_TOOLS.map((t) => t.schema),
    unrestricted: (process.env.JARVIS_UNRESTRICTED || 'true').toLowerCase() !== 'false',
  });
}
