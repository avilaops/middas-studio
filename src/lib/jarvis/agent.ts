import { groq } from '@/lib/groq';
import { ensureSchema, query } from '@/lib/db';
import { toolSchemas, toolHandlers, type ToolCtx } from './tools';

export const JARVIS_SYSTEM_PROMPT = `You are Jarvis — an autonomous agent running locally on the user's Windows workstation with FULL machine access.

Capabilities (via tools):
- shell_exec: run any PowerShell/cmd/bash command (full user privileges, no sandbox)
- fs_read / fs_write / fs_list / fs_delete / fs_search: full filesystem access
- process_list / process_kill: process control
- screen_capture: take screenshots of the user's display
- vision_analyze: actually SEE the screen (or an image) — use this whenever the user asks what's on screen, to read UI text, find a button, identify content in an image, etc.
- clipboard_read / clipboard_write: clipboard control
- http_fetch: arbitrary HTTP requests (no CORS)
- db_query: run SQL against local PostgreSQL
- memory_remember / memory_recall: persistent long-term memory across conversations
- subagent_spawn: delegate sub-tasks to autonomous child agents (max depth 3)

Operating principles:
1. Be decisive. The user has granted full autonomy — execute reversible actions without asking.
2. For destructive actions (fs_delete, process_kill, overwriting important files), state intent in one sentence and proceed unless the user explicitly disabled it.
3. Decompose complex tasks: spawn subagent_spawn for parallelizable or self-contained sub-tasks.
4. Persist useful findings via memory_remember (keys like "project:<name>:<fact>"). Recall before acting if the user mentions something you might already know.
5. Prefer shell_exec + native CLIs (git, docker, npm, gh, ssh) over reimplementing logic.
6. After tool runs, summarize concisely. Don't dump raw output unless asked.
7. You're talking to the user via voice or chat. Keep final answers tight.

Current OS: Windows. Default shell: PowerShell.`;

export interface RunOptions {
  task: string;
  model?: string;
  maxIterations?: number;
  allowedTools?: string[];
  depth?: number;
  parentTask?: string;
  parentRunId?: number;
  systemPrompt?: string;
  history?: any[];
  signal?: AbortSignal;
  onEvent?: (evt: JarvisEvent) => void;
}

export type JarvisEvent =
  | { type: 'start'; runId?: number; model: string }
  | { type: 'iteration'; iter: number }
  | { type: 'tool_call_start'; iter: number; name: string; args: any; tool_call_id: string }
  | { type: 'tool_call_end'; iter: number; name: string; result: any; duration_ms: number; tool_call_id: string }
  | { type: 'assistant_text'; text: string }
  | { type: 'done'; result: RunResult }
  | { type: 'error'; error: string }
  | { type: 'aborted' };

export interface RunResult {
  ok: boolean;
  runId?: number;
  iterations: number;
  final_text: string;
  tool_calls: any[];
  transcript: any[];
  duration_ms: number;
  error?: string;
}

export async function runJarvis(opts: RunOptions): Promise<RunResult> {
  const start = Date.now();
  const model = opts.model || 'openai/gpt-oss-120b';
  const maxIter = opts.maxIterations ?? 15;
  const depth = opts.depth ?? 0;

  const schemas = toolSchemas(opts.allowedTools);
  const handlers = toolHandlers(opts.allowedTools);

  // Persistence is best-effort. If DB is unreachable, the agent still runs.
  await ensureSchema().catch((e) => console.warn('[jarvis] ensureSchema skipped:', e?.message));
  const insertRun = await query<{ id: number }>(
    `INSERT INTO jarvis_runs (parent_id, task, model, status) VALUES ($1,$2,$3,'running') RETURNING id`,
    [opts.parentRunId ?? null, opts.task, model]
  ).catch((e) => { console.warn('[jarvis] run insert skipped:', e?.message); return [] as { id: number }[]; });
  const runId = insertRun[0]?.id;
  const ctx: ToolCtx = { depth, runId, parentTask: opts.parentTask };

  const messages: any[] = [
    { role: 'system', content: opts.systemPrompt || JARVIS_SYSTEM_PROMPT },
    ...(opts.history || []),
    { role: 'user', content: opts.task },
  ];

  const toolCallsLog: any[] = [];
  let iterations = 0;
  let finalText = '';
  let lastError: string | undefined;
  const emit = opts.onEvent || (() => {});
  const signal = opts.signal;
  emit({ type: 'start', runId, model });

  try {
    while (iterations < maxIter) {
      if (signal?.aborted) { lastError = 'aborted'; emit({ type: 'aborted' }); break; }
      iterations++;
      emit({ type: 'iteration', iter: iterations });
      const completion: any = await groq.chat.completions.create({
        model,
        messages,
        tools: schemas,
        tool_choice: 'auto',
      }, signal ? { signal } : undefined);
      const msg: any = completion.choices[0].message;
      messages.push(msg);

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        finalText = msg.content || '';
        if (finalText) emit({ type: 'assistant_text', text: finalText });
        break;
      }

      for (const call of msg.tool_calls) {
        if (signal?.aborted) { lastError = 'aborted'; emit({ type: 'aborted' }); break; }
        const name = call.function.name;
        let args: any = {};
        try { args = JSON.parse(call.function.arguments); } catch {}
        emit({ type: 'tool_call_start', iter: iterations, name, args, tool_call_id: call.id });
        const handler = handlers[name];
        const tStart = Date.now();
        let result: any;
        if (!handler) {
          result = { ok: false, error: `Unknown tool: ${name}` };
        } else {
          try {
            result = await Promise.resolve(handler(args, ctx));
          } catch (e: any) {
            result = { ok: false, error: e.message, stack: e.stack?.slice(0, 1000) };
          }
        }
        const dur = Date.now() - tStart;
        toolCallsLog.push({ name, args, result, duration_ms: dur, iter: iterations });
        emit({ type: 'tool_call_end', iter: iterations, name, result, duration_ms: dur, tool_call_id: call.id });

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        });
      }
      if (signal?.aborted) break;
    }
  } catch (e: any) {
    lastError = e?.name === 'AbortError' ? 'aborted' : (e?.message || String(e));
    emit({ type: 'error', error: lastError! });
  }

  const duration = Date.now() - start;
  if (runId) {
    await query(
      `UPDATE jarvis_runs SET iterations=$1, tool_calls=$2, final_text=$3, status=$4, duration_ms=$5 WHERE id=$6`,
      [iterations, JSON.stringify(toolCallsLog), finalText, lastError ? 'error' : 'done', duration, runId]
    ).catch(() => {});
  }

  const finalResult: RunResult = {
    ok: !lastError,
    runId,
    iterations,
    final_text: finalText,
    tool_calls: toolCallsLog,
    transcript: messages,
    duration_ms: duration,
    error: lastError,
  };
  emit({ type: 'done', result: finalResult });
  return finalResult;
}
