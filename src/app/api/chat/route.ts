import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';
import { ensureSchema, query } from '@/lib/db';
import { logApi } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await ensureSchema();
  const body = await req.json();
  const start = Date.now();

  try {
    const {
      model = 'llama-3.3-70b-versatile',
      messages,
      temperature = 0.7,
      max_tokens,
      top_p = 1,
      stream = false,
      response_format,
      stop,
      seed,
      session_id,
      save = true,
      apiKey, // BYOK - Bring Your Own Key
    } = body;

    // Use provided API key if available (BYOK), otherwise use environment variable
    const groqKey = apiKey || process.env.GROQ_API_KEY;
    
    if (!groqKey) {
      throw new Error('Groq API Key is required. Configure it in settings or environment variable.');
    }

    if (stream) {
      const completion = await groq.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens,
        top_p,
        stream: true,
        stop,
        seed,
        response_format,
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          let fullText = '';
          try {
            for await (const chunk of completion as any) {
              const delta = chunk.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullText += delta;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
              }
            }
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));

            if (save) {
              try {
                let sid = session_id;
                if (!sid) {
                  const r = await query<{ id: number }>(
                    `INSERT INTO chat_sessions (title, model) VALUES ($1,$2) RETURNING id`,
                    [messages[messages.length - 1]?.content?.slice(0, 80) || 'Chat', model]
                  );
                  sid = r[0].id;
                }
                const last = messages[messages.length - 1];
                await query(
                  `INSERT INTO chat_messages (session_id, role, content) VALUES ($1,$2,$3)`,
                  [sid, last.role, last.content]
                );
                await query(
                  `INSERT INTO chat_messages (session_id, role, content, latency_ms) VALUES ($1,'assistant',$2,$3)`,
                  [sid, fullText, Date.now() - start]
                );
              } catch (e) { /* ignore */ }
            }
          } catch (e: any) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }

    const completion = await groq.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
      top_p,
      stream: false,
      stop,
      seed,
      response_format,
    });

    const duration = Date.now() - start;
    await logApi({
      module: 'chat',
      endpoint: '/chat/completions',
      model,
      request: { model, messages_count: messages.length },
      response: { usage: completion.usage },
      status_code: 200,
      duration_ms: duration,
    });

    return NextResponse.json({ ...completion, duration_ms: duration });
  } catch (e: any) {
    await logApi({
      module: 'chat',
      endpoint: '/chat/completions',
      error: e.message,
      status_code: 500,
      duration_ms: Date.now() - start,
    });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
