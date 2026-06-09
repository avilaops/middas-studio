'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Loader2, Trash2, Terminal, Wrench, ChevronDown, ChevronRight, Sparkles, AlertTriangle, Square } from 'lucide-react';
import { GROQ_MODELS } from '@/lib/groq-models';
import { useGroqModels, isChatLikeModel } from '@/lib/use-groq-models';

type ToolCall = {
  name: string;
  args: any;
  result: any;
  duration_ms: number;
  iter: number;
};

type Turn = {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  iterations?: number;
  duration_ms?: number;
  error?: string;
};

const PRESETS = [
  { label: 'List my Downloads folder', task: 'List the contents of D:\\Downloads (or C:\\Users\\Administrador\\Downloads) and tell me which 5 files are largest.' },
  { label: 'Active dev processes', task: 'Show me all running node and powershell processes with their memory usage.' },
  { label: 'Screenshot + describe', task: 'Take a screenshot and tell me what is currently on screen.' },
  { label: 'Git status of groq-studio', task: 'Run git status in d:\\Projetos\\avilaops\\Ferramentas\\groq-studio and summarize.' },
  { label: 'Subagent recon', task: 'Spawn a subagent to inventory all Docker containers and another subagent to list all listening ports. Merge the findings.' },
];

export default function JarvisModule() {
  const availableModels = useGroqModels(isChatLikeModel, GROQ_MODELS.chat);
  const [model, setModel] = useState('openai/gpt-oss-120b');
  const [maxIter, setMaxIter] = useState(15);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [unrestricted, setUnrestricted] = useState(true);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const scrollerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch('/api/jarvis')
      .then((r) => r.json())
      .then((d) => {
        setUnrestricted(!!d.unrestricted);
        setAvailableTools((d.tools || []).map((t: any) => t.function.name));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  async function send(taskOverride?: string) {
    const task = (taskOverride ?? input).trim();
    if (!task || busy) return;
    setInput('');
    const userTurn: Turn = { role: 'user', content: task };
    const history = turns.flatMap((t) => {
      if (t.role === 'user') return [{ role: 'user', content: t.content }];
      return t.content ? [{ role: 'assistant', content: t.content }] : [];
    });
    setTurns((s) => [...s, userTurn, { role: 'assistant', content: '', toolCalls: [] }]);
    setBusy(true);

    const ctl = new AbortController();
    abortRef.current = ctl;
    const pending: Record<string, { name: string; args: any; start: number }> = {};

    const apply = (mut: (t: Turn) => Turn) => {
      setTurns((s) => {
        const copy = [...s];
        copy[copy.length - 1] = mut(copy[copy.length - 1]);
        return copy;
      });
    };

    try {
      const r = await fetch('/api/jarvis/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: ctl.signal,
        body: JSON.stringify({
          task,
          messages: [...history, { role: 'user', content: task }],
          model,
          max_iterations: maxIter,
        }),
      });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const chunks = buf.split('\n\n');
        buf = chunks.pop() || '';
        for (const chunk of chunks) {
          const line = chunk.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          let evt: any;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }
          if (evt.type === 'tool_call_start') {
            pending[evt.tool_call_id] = { name: evt.name, args: evt.args, start: Date.now() };
            apply((t) => ({
              ...t,
              toolCalls: [
                ...(t.toolCalls || []),
                { name: evt.name, args: evt.args, result: null, duration_ms: 0, iter: evt.iter },
              ],
            }));
          } else if (evt.type === 'tool_call_end') {
            apply((t) => ({
              ...t,
              toolCalls: (t.toolCalls || []).map((tc, idx, arr) =>
                idx === arr.length - 1 || (tc.name === evt.name && tc.result === null)
                  ? { ...tc, result: evt.result, duration_ms: evt.duration_ms }
                  : tc
              ),
            }));
          } else if (evt.type === 'assistant_text') {
            apply((t) => ({ ...t, content: evt.text }));
          } else if (evt.type === 'done') {
            apply((t) => ({
              ...t,
              content: evt.result.final_text || t.content || '(no response)',
              iterations: evt.result.iterations,
              duration_ms: evt.result.duration_ms,
              error: evt.result.error,
              toolCalls: evt.result.tool_calls,
            }));
          } else if (evt.type === 'error') {
            apply((t) => ({ ...t, error: evt.error }));
          } else if (evt.type === 'aborted') {
            apply((t) => ({ ...t, error: 'aborted by user' }));
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        apply((t) => ({ ...t, error: e.message }));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  function toggle(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="w-4 h-4 text-orange-500" /> Jarvis
          <span className={`px-2 py-0.5 rounded text-xs ${unrestricted ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-600'}`}>
            {unrestricted ? 'UNRESTRICTED' : 'sandboxed'}
          </span>
        </div>

        <label className="flex items-center gap-2 text-xs">
          Model
          <select value={model} onChange={(e) => setModel(e.target.value)} className="bg-neutral-200 dark:bg-neutral-800 rounded px-2 py-1 text-xs">
            {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs">
          Max iter
          <input
            type="number"
            min={1}
            max={50}
            value={maxIter}
            onChange={(e) => setMaxIter(Number(e.target.value))}
            className="w-16 bg-neutral-200 dark:bg-neutral-800 rounded px-2 py-1 text-xs"
          />
        </label>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-neutral-500">{availableTools.length} tools</span>
          <button
            onClick={() => setTurns([])}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        </div>
      </div>

      {turns.length === 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => send(p.task)}
              className="text-left text-xs p-3 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-orange-500/50 transition"
            >
              <Sparkles className="w-3 h-3 inline mr-1 text-orange-500" />
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div ref={scrollerRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {turns.map((t, i) => (
          <div key={i} className={`flex gap-2 ${t.role === 'user' ? 'justify-end' : ''}`}>
            <div className={`max-w-[85%] rounded-lg p-3 ${t.role === 'user' ? 'bg-orange-500 text-white' : 'bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800'}`}>
              {t.role === 'assistant' && t.toolCalls && t.toolCalls.length > 0 && (
                <div className="mb-2 space-y-1">
                  {t.toolCalls.map((tc, j) => {
                    const id = `${i}-${j}`;
                    const isErr = tc.result?.ok === false;
                    return (
                      <div key={id} className="text-xs">
                        <button
                          onClick={() => toggle(id)}
                          className={`flex items-center gap-1 w-full text-left rounded px-2 py-1 ${isErr ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-orange-500/10 text-orange-700 dark:text-orange-400'}`}
                        >
                          {expanded[id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          <Wrench className="w-3 h-3" />
                          <span className="font-mono">{tc.name}</span>
                          <span className="ml-auto text-neutral-500">{tc.duration_ms}ms</span>
                        </button>
                        {expanded[id] && (
                          <div className="mt-1 p-2 rounded bg-neutral-950 text-neutral-200 font-mono text-[10px] overflow-x-auto">
                            <div className="text-neutral-500">args:</div>
                            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(tc.args, null, 2)}</pre>
                            <div className="text-neutral-500 mt-1">result:</div>
                            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(tc.result, null, 2).slice(0, 4000)}</pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {t.error && (
                <div className="text-red-500 text-xs mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {t.error}
                </div>
              )}
              <div className="whitespace-pre-wrap text-sm">{t.content}</div>
              {t.role === 'assistant' && (t.iterations || t.duration_ms) && (
                <div className="mt-2 text-[10px] text-neutral-500 flex items-center gap-2">
                  <Terminal className="w-3 h-3" />
                  {t.iterations} iter · {t.duration_ms}ms · {t.toolCalls?.length || 0} tool calls
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Jarvis is working…
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder="Diga o que fazer. Ex: 'olha minha tela', 'mata processos com mais de 1GB de RAM', 'spawn 3 subagents para investigar os 3 maiores arquivos do projeto'…"
          rows={2}
          className="flex-1 resize-none rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button
          onClick={() => (busy ? cancel() : send())}
          disabled={!busy && !input.trim()}
          className={`px-4 rounded-lg ${busy ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'} text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 text-sm`}
        >
          {busy ? <Square className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          {busy ? 'Stop' : 'Send'}
        </button>
      </div>
    </div>
  );
}
