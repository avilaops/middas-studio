import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';
import { ensureSchema, query } from '@/lib/db';
import { logApi } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Built-in demo tool registry — extend as needed.
const TOOLS_REGISTRY: Record<string, (args: any) => any | Promise<any>> = {
  get_weather: ({ location, unit = 'celsius' }: any) => ({
    location,
    unit,
    temperature: Math.round(15 + Math.random() * 15),
    condition: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)],
  }),
  get_time: ({ timezone = 'UTC' }: any) => ({
    timezone,
    iso: new Date().toISOString(),
    locale: new Date().toLocaleString('en-US', { timeZone: timezone }),
  }),
  calculate: ({ expression }: any) => {
    try { return { result: Function(`"use strict";return (${expression})`)() }; }
    catch (e: any) { return { error: e.message }; }
  },
  random_number: ({ min = 0, max = 100 }: any) => ({
    value: Math.floor(min + Math.random() * (max - min + 1)),
    min, max,
  }),
  base64_encode: ({ text }: any) => ({
    encoded: Buffer.from(text, 'utf8').toString('base64'),
  }),
  base64_decode: ({ data }: any) => {
    try { return { decoded: Buffer.from(data, 'base64').toString('utf8') }; }
    catch (e: any) { return { error: e.message }; }
  },
  fetch_url: async ({ url }: any) => {
    try {
      const r = await fetch(url, { method: 'GET' });
      const text = await r.text();
      return {
        status: r.status,
        content_type: r.headers.get('content-type'),
        body: text.slice(0, 5000),
        truncated: text.length > 5000,
      };
    } catch (e: any) { return { error: e.message }; }
  },
  word_count: ({ text }: any) => ({
    chars: text.length,
    words: text.trim().split(/\s+/).filter(Boolean).length,
    lines: text.split('\n').length,
  }),
};

export async function POST(req: NextRequest) {
  await ensureSchema();
  const start = Date.now();
  try {
    const {
      model = 'llama-3.3-70b-versatile',
      messages,
      tools,
      tool_choice = 'auto',
      max_iterations = 5,
    } = await req.json();

    let conversation = [...messages];
    let iterations = 0;
    let finalCompletion: any;

    while (iterations < max_iterations) {
      iterations++;
      finalCompletion = await groq.chat.completions.create({
        model,
        messages: conversation,
        tools,
        tool_choice,
      });

      const msg: any = finalCompletion.choices[0].message;
      conversation.push(msg);

      if (!msg.tool_calls || msg.tool_calls.length === 0) break;

      for (const call of msg.tool_calls) {
        const fnName = call.function.name;
        let args: any = {};
        try { args = JSON.parse(call.function.arguments); } catch {}
        const handler = TOOLS_REGISTRY[fnName];
        const result = handler
          ? await Promise.resolve(handler(args))
          : { error: `Tool '${fnName}' not implemented server-side` };

        await query(
          `INSERT INTO tool_calls_log (function_name, arguments, result) VALUES ($1,$2,$3)`,
          [fnName, JSON.stringify(args), JSON.stringify(result)]
        );

        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    const duration = Date.now() - start;
    await logApi({ module: 'tools', endpoint: '/tools', model, status_code: 200, duration_ms: duration });

    return NextResponse.json({
      iterations,
      conversation,
      final: finalCompletion,
      duration_ms: duration,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    available_tools: Object.keys(TOOLS_REGISTRY),
    sample_schemas: [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
              unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
            },
            required: ['location'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'calculate',
          description: 'Evaluate a math expression',
          parameters: {
            type: 'object',
            properties: { expression: { type: 'string' } },
            required: ['expression'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_time',
          description: 'Get current time',
          parameters: {
            type: 'object',
            properties: { timezone: { type: 'string' } },
          },
        },
      },
    ],
  });
}
