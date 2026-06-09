import { NextRequest } from 'next/server';
import { runJarvis } from '@/lib/jarvis/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    task,
    messages,
    model,
    max_iterations,
    allowed_tools,
    system_prompt,
  } = body;

  const history = messages ? messages.filter((m: any) => m.role !== 'system') : [];
  const userTask =
    task ||
    [...history].reverse().find((m: any) => m.role === 'user')?.content ||
    '';
  const priorHistory = task ? history : history.slice(0, -1);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
        } catch {}
      };

      const abortCtl = new AbortController();
      const onClientAbort = () => abortCtl.abort();
      req.signal.addEventListener('abort', onClientAbort);

      try {
        await runJarvis({
          task: userTask,
          model,
          maxIterations: max_iterations,
          allowedTools: allowed_tools,
          systemPrompt: system_prompt,
          history: priorHistory,
          signal: abortCtl.signal,
          onEvent: send,
        });
      } catch (e: any) {
        send({ type: 'error', error: e?.message || String(e) });
      } finally {
        req.signal.removeEventListener('abort', onClientAbort);
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    },
  });
}
