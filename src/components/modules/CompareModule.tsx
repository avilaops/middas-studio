'use client';

import { useEffect, useState } from 'react';
import { GitCompare, Loader2, Trophy } from 'lucide-react';
import { GROQ_MODELS } from '@/lib/groq-models';
import { estimateCost, formatCost } from '@/lib/pricing';

const FALLBACK_MODELS = Array.from(
  new Set([...GROQ_MODELS.chat, ...GROQ_MODELS.reasoning])
);

export default function CompareModule() {
  const [allModels, setAllModels] = useState<string[]>(FALLBACK_MODELS);
  const [selected, setSelected] = useState<string[]>([
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'openai/gpt-oss-20b',
  ]);

  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((j) => {
        const list: any[] = Array.isArray(j?.data) ? j.data : [];
        const ids = list
          .filter((m) => m?.active !== false)
          .map((m) => m?.id)
          .filter((id: any): id is string => typeof id === 'string');
        if (ids.length) {
          setAllModels(Array.from(new Set(ids)));
        }
      })
      .catch(() => {});
  }, []);
  const [prompt, setPrompt] = useState('Explique recursão em uma frase.');
  const [system, setSystem] = useState('You are a concise assistant.');
  const [temperature, setTemperature] = useState(0.7);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  function toggle(m: string) {
    setSelected((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));
  }

  async function run() {
    setLoading(true); setResult(null);
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: selected, prompt, system, temperature }),
      });
      setResult(await res.json());
    } catch (e: any) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  }

  const fastest = result?.runs?.filter((r: any) => r.ok)
    .reduce((a: any, b: any) => (a && a.latency_ms < b.latency_ms ? a : b), null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4 panel p-4 space-y-4">
          <div className="text-sm font-medium flex items-center gap-2">
            <GitCompare className="w-4 h-4" /> Compare Models
          </div>

          <div>
            <div className="label">Models ({selected.length} selected)</div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {allModels.map((m) => (
                <label key={m} className="flex items-center gap-2 text-xs hover:bg-gray-100 dark:bg-groq-panel/50 rounded px-2 py-1 cursor-pointer">
                  <input type="checkbox" checked={selected.includes(m)} onChange={() => toggle(m)}
                    className="accent-groq-orange" />
                  <span className="font-mono">{m}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="label">Temperature: {temperature}</div>
            <input aria-label="Temperature" type="range" min={0} max={2} step={0.1} value={temperature}
              onChange={(e) => setTemperature(+e.target.value)} className="w-full accent-groq-orange" />
          </div>

          <div>
            <div className="label">System</div>
            <textarea aria-label="System prompt" className="input min-h-[60px]" value={system}
              onChange={(e) => setSystem(e.target.value)} />
          </div>

          <button onClick={run} disabled={loading || selected.length === 0 || !prompt.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
            Run on {selected.length} models
          </button>
        </div>

        <div className="col-span-8 panel p-4">
          <div className="label">Prompt</div>
          <textarea aria-label="Prompt" className="input min-h-[120px]" value={prompt}
            onChange={(e) => setPrompt(e.target.value)} />
          {result?.total_duration_ms && (
            <div className="text-xs text-gray-500 dark:text-groq-muted mt-2">
              Total wall clock: {result.total_duration_ms}ms
            </div>
          )}
        </div>
      </div>

      {result?.runs && (
        <div className={`grid gap-3 ${selected.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {result.runs.map((r: any) => {
            const cost = r.usage ? estimateCost(r.model, r.usage.prompt_tokens, r.usage.completion_tokens) : 0;
            const isFastest = fastest?.model === r.model;
            return (
              <div key={r.model}
                className={`panel p-4 ${isFastest ? 'border-groq-orange ring-1 ring-groq-orange/30' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-mono text-xs font-medium text-groq-orange truncate">{r.model}</div>
                  {isFastest && <Trophy className="w-4 h-4 text-yellow-400" />}
                </div>
                {r.ok ? (
                  <>
                    <div className="text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">{r.text}</div>
                    <div className="border-t border-gray-200 dark:border-groq-border mt-3 pt-2 flex justify-between text-xs text-gray-500 dark:text-groq-muted">
                      <span>{r.latency_ms}ms</span>
                      {r.usage && <span>{r.usage.total_tokens} tok</span>}
                      <span>{formatCost(cost)}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-red-400 text-xs">❌ {r.error}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
