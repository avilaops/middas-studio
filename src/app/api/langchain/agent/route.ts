import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ChatGroq } from '@langchain/groq';
import { tool } from '@langchain/core/tools';
import { createAgent } from 'langchain';
import { z } from 'zod';
import { knowledgeStore } from '@/lib/knowledge-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'groq_api_key';

function resolveKey(): string {
  try {
    const c = cookies().get(COOKIE_NAME);
    if (c?.value) return c.value;
  } catch {}
  return process.env.GROQ_API_KEY || '';
}

// ---------------- Tools ----------------

const calculatorTool = tool(
  async ({ expression }: { expression: string }) => {
    // Safe-ish math: only digits, operators, parens, dots, spaces
    if (!/^[\d+\-*/().\s,%^]+$/.test(expression)) {
      return 'Error: expression contains invalid characters.';
    }
    try {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expression.replace(/\^/g, '**')})`)();
      return String(result);
    } catch (e: any) {
      return `Error: ${e?.message || 'invalid expression'}`;
    }
  },
  {
    name: 'calculator',
    description: 'Evaluate a math expression. Supports + - * / ( ) and ** (power). Use for any arithmetic.',
    schema: z.object({
      expression: z.string().describe('Math expression like "2 * (3 + 4)"'),
    }),
  }
);

const webSearchTool = tool(
  async ({ query }: { query: string }) => {
    // DuckDuckGo Instant Answer API — no key required
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Groq-Studio-LangChain' } });
      const data = await r.json();
      const parts: string[] = [];
      if (data.AbstractText) parts.push(`Summary: ${data.AbstractText}`);
      if (data.AbstractURL) parts.push(`Source: ${data.AbstractURL}`);
      if (Array.isArray(data.RelatedTopics)) {
        const topics = data.RelatedTopics.slice(0, 5)
          .map((t: any) => t.Text || t.Result)
          .filter(Boolean);
        if (topics.length) parts.push(`Related:\n- ${topics.join('\n- ')}`);
      }
      return parts.join('\n\n') || `No results for "${query}".`;
    } catch (e: any) {
      return `Search error: ${e?.message || 'unknown'}`;
    }
  },
  {
    name: 'web_search',
    description: 'Search the web for current information. Use when the user asks about facts, news, or things you may not know.',
    schema: z.object({
      query: z.string().describe('Search query'),
    }),
  }
);

const fetchUrlTool = tool(
  async ({ url }: { url: string }) => {
    try {
      const u = new URL(url);
      if (!['http:', 'https:'].includes(u.protocol)) return 'Error: only http/https URLs.';
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Groq-Studio-LangChain' },
        signal: AbortSignal.timeout(10000),
      });
      const text = await r.text();
      // Strip HTML tags + collapse whitespace, cap length
      const stripped = text.replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return stripped.slice(0, 4000);
    } catch (e: any) {
      return `Fetch error: ${e?.message || 'unknown'}`;
    }
  },
  {
    name: 'fetch_url',
    description: 'Fetch and read the text content of a public URL. Use after web_search to read a source.',
    schema: z.object({
      url: z.string().describe('Full http(s) URL'),
    }),
  }
);

const codeExecTool = tool(
  async ({ code }: { code: string }) => {
    try {
      // Sandbox-ish JS exec. Returns the value of the last expression or what is printed via console.log.
      const logs: string[] = [];
      const sandboxConsole = { log: (...a: any[]) => logs.push(a.map(String).join(' ')) };
      // eslint-disable-next-line no-new-func
      const fn = new Function('console', `"use strict"; ${code}`);
      const result = await Promise.resolve().then(() => fn(sandboxConsole));
      const out = [logs.join('\n'), result === undefined ? '' : `=> ${JSON.stringify(result)}`].filter(Boolean).join('\n');
      return out || '(no output)';
    } catch (e: any) {
      return `Exec error: ${e?.message || 'unknown'}`;
    }
  },
  {
    name: 'code_exec',
    description: 'Execute a snippet of pure JavaScript (no network, no DOM). Use console.log to print. Good for data transformations.',
    schema: z.object({
      code: z.string().describe('JavaScript code to run'),
    }),
  }
);

const datetimeTool = tool(
  async ({ timezone }: { timezone?: string }) => {
    try {
      const tz = timezone || 'UTC';
      const now = new Date();
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        dateStyle: 'full',
        timeStyle: 'long',
      });
      return `${fmt.format(now)} (ISO: ${now.toISOString()}, timezone: ${tz})`;
    } catch (e: any) {
      return `Error: ${e?.message || 'invalid timezone'}`;
    }
  },
  {
    name: 'datetime',
    description: 'Get the current date and time, optionally in a specific IANA timezone (e.g. "America/Sao_Paulo", "Asia/Tokyo").',
    schema: z.object({
      timezone: z.string().optional().describe('IANA timezone like "America/Sao_Paulo"'),
    }),
  }
);

const weatherTool = tool(
  async ({ city }: { city: string }) => {
    try {
      // Geocode via Open-Meteo (no key required)
      const geoR = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
      );
      const geo = await geoR.json();
      const place = geo?.results?.[0];
      if (!place) return `Could not find location "${city}".`;
      const wR = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`
      );
      const w = await wR.json();
      const c = w?.current;
      if (!c) return 'Weather data unavailable.';
      return `Weather in ${place.name}, ${place.country}: ${c.temperature_2m}°C, humidity ${c.relative_humidity_2m}%, wind ${c.wind_speed_10m} km/h.`;
    } catch (e: any) {
      return `Weather error: ${e?.message || 'unknown'}`;
    }
  },
  {
    name: 'weather',
    description: 'Get current weather for a city. Uses Open-Meteo (no key required). Provide just the city name.',
    schema: z.object({
      city: z.string().describe('City name, e.g. "São Paulo" or "Tokyo"'),
    }),
  }
);

const ALL_TOOLS = {
  calculator: calculatorTool,
  web_search: webSearchTool,
  fetch_url: fetchUrlTool,
  code_exec: codeExecTool,
  datetime: datetimeTool,
  weather: weatherTool,
  knowledge_search: tool(
    async ({ query, k }: { query: string; k?: number }) => {
      const hits = knowledgeStore.search(query, k || 4);
      if (!hits.length) return 'No relevant chunks found in the knowledge base.';
      return hits
        .map((h, i) => `[${i + 1}] (${h.source}, score=${h.score})\n${h.text}`)
        .join('\n\n---\n\n');
    },
    {
      name: 'knowledge_search',
      description: 'Search the user-uploaded knowledge base for relevant text chunks. Use when answering questions about uploaded documents, notes, or any custom data the user added.',
      schema: z.object({
        query: z.string().describe('Natural-language query'),
        k: z.number().optional().describe('Number of chunks to return (default 4)'),
      }),
    }
  ),
} as const;

// ---------------- Route ----------------

export async function POST(req: NextRequest) {
  const key = resolveKey();
  if (!key) {
    return NextResponse.json({ error: 'GROQ_API_KEY not set. Configure it in Settings.' }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    model = 'llama-3.3-70b-versatile',
    messages = [],
    tools: enabled = ['calculator', 'web_search', 'fetch_url', 'code_exec'],
    system = 'You are a capable AI agent. Use the provided tools when helpful and cite which tool you used.',
    temperature = 0.3,
    max_iterations = 6,
  } = body;

  const selectedTools = (enabled as string[])
    .map((n) => (ALL_TOOLS as any)[n])
    .filter(Boolean);

  const llm = new ChatGroq({
    apiKey: key,
    model,
    temperature,
  });

  const agent = createAgent({
    model: llm,
    tools: selectedTools,
    systemPrompt: system,
  });

  const formatted = [
    ...messages.map((m: any) => ({ role: m.role, content: m.content })),
  ];

  // Streaming branch (SSE)
  if (body.stream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {}
        };
        try {
          const events = agent.streamEvents(
            { messages: formatted },
            { version: 'v2', recursionLimit: max_iterations * 3 } as any
          );
          let inputTokens = 0;
          let outputTokens = 0;
          for await (const e of events as any) {
            if (e.event === 'on_chat_model_stream') {
              const chunk = e.data?.chunk?.content;
              const text = typeof chunk === 'string'
                ? chunk
                : Array.isArray(chunk)
                  ? chunk.map((c: any) => (typeof c === 'string' ? c : c.text || '')).join('')
                  : '';
              if (text) send('token', text);
            } else if (e.event === 'on_chat_model_end') {
              const u = e.data?.output?.usage_metadata;
              if (u) {
                inputTokens += u.input_tokens || 0;
                outputTokens += u.output_tokens || 0;
              }
            } else if (e.event === 'on_tool_start') {
              send('tool_call', { name: e.name, args: e.data?.input });
            } else if (e.event === 'on_tool_end') {
              const out = e.data?.output;
              const content = typeof out === 'string' ? out : out?.content ?? JSON.stringify(out ?? '');
              send('tool_result', { name: e.name, content: String(content).slice(0, 2000) });
            }
          }
          send('usage', { input_tokens: inputTokens, output_tokens: outputTokens });
          send('done', {});
        } catch (err: any) {
          send('error', { message: err?.message || 'Agent error' });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  try {
    const result = await agent.invoke(
      { messages: formatted },
      { recursionLimit: max_iterations * 3 }
    );

    // Extract final assistant message + intermediate tool calls
    const msgs: any[] = result.messages || [];
    const last = msgs[msgs.length - 1];
    const finalText = typeof last?.content === 'string'
      ? last.content
      : Array.isArray(last?.content)
        ? last.content.map((c: any) => (typeof c === 'string' ? c : c.text || '')).join('')
        : String(last?.content ?? '');

    const steps = msgs
      .filter((m) => m?.tool_calls?.length || m?.name)
      .map((m) => ({
        type: m.tool_calls ? 'tool_call' : 'tool_result',
        name: m.name || m.tool_calls?.[0]?.name,
        args: m.tool_calls?.[0]?.args,
        content: typeof m.content === 'string' ? m.content : undefined,
      }));

    let inputTokens = 0;
    let outputTokens = 0;
    for (const m of msgs) {
      const u = m?.usage_metadata;
      if (u) {
        inputTokens += u.input_tokens || 0;
        outputTokens += u.output_tokens || 0;
      }
    }

    return NextResponse.json({
      output: finalText,
      steps,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Agent error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    tools: Object.keys(ALL_TOOLS).map((name) => ({
      name,
      description: (ALL_TOOLS as any)[name].description,
    })),
  });
}
