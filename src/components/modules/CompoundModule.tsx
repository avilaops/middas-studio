'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Globe, Copy } from 'lucide-react';
import { estimateCost, formatCost } from '@/lib/pricing';

export default function CompoundModule() {
  const [model, setModel] = useState('compound-beta');
  const [prompt, setPrompt] = useState('Quais foram as últimas notícias sobre IA hoje? Resuma em 3 bullets.');
  const [includeDomains, setIncludeDomains] = useState('');
  const [excludeDomains, setExcludeDomains] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true); setResult(null);
    try {
      const res = await fetch('/api/compound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          include_domains: includeDomains ? includeDomains.split(',').map((s) => s.trim()) : undefined,
          exclude_domains: excludeDomains ? excludeDomains.split(',').map((s) => s.trim()) : undefined,
        }),
      });
      setResult(await res.json());
    } catch (e: any) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  }

  const msg = result?.choices?.[0]?.message;
  const executed = msg?.executed_tools || [];

  return (
    <div className="grid grid-cols-12 gap-4">
      <aside className="col-span-4 panel p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-groq-orange" />
          <span className="text-gray-500 dark:text-groq-muted">Agentic system com Web Search + Code Execution</span>
        </div>
        <div>
          <div className="label">Model</div>
          <select aria-label="Compound model" className="input" value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="compound-beta">compound-beta (multi-tool)</option>
            <option value="compound-beta-mini">compound-beta-mini (faster)</option>
          </select>
        </div>
        <div>
          <div className="label">Include domains (csv, opcional)</div>
          <input className="input" placeholder="arxiv.org, github.com"
            value={includeDomains} onChange={(e) => setIncludeDomains(e.target.value)} />
        </div>
        <div>
          <div className="label">Exclude domains (csv, opcional)</div>
          <input className="input" placeholder="reddit.com"
            value={excludeDomains} onChange={(e) => setExcludeDomains(e.target.value)} />
        </div>
        <button onClick={run} disabled={loading || !prompt.trim()}
          className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Run agent
        </button>
      </aside>

      <section className="col-span-8 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="panel p-4">
          <div className="label">Prompt</div>
          <textarea aria-label="Prompt" className="input min-h-[100px]" value={prompt}
            onChange={(e) => setPrompt(e.target.value)} />
        </div>
        {result?.error && <div className="panel p-4 text-red-400 text-sm">❌ {result.error}</div>}
        {executed.length > 0 && (
          <div className="panel p-4">
            <div className="label flex items-center gap-2"><Globe className="w-3 h-3" /> Executed Tools ({executed.length})</div>
            <div className="space-y-2 mt-2">
              {executed.map((t: any, i: number) => (
                <div key={i} className="bg-gray-100 dark:bg-black/40 rounded p-2 text-xs font-mono">
                  <div className="text-groq-orange">{t.type}</div>
                  <pre className="text-gray-500 dark:text-groq-muted whitespace-pre-wrap mt-1">{JSON.stringify(t, null, 2)}</pre>
                </div>
              ))}
            </div>
          </div>
        )}
        {msg?.content && (
          <div className="panel p-4">
            <div className="label flex items-center justify-between">
              <span>Response</span>
              <button onClick={() => navigator.clipboard.writeText(msg.content)}
                className="btn-ghost text-xs flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
            </div>
            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
          </div>
        )}
        {result?.usage && (
          <div className="text-xs text-gray-500 dark:text-groq-muted flex gap-3">
            <span>Tokens: {result.usage.total_tokens}</span>
            <span>Latency: {result.duration_ms}ms</span>
            <span className="text-groq-orange">Cost: {formatCost(estimateCost(model, result.usage.prompt_tokens || 0, result.usage.completion_tokens || 0))}</span>
          </div>
        )}
      </section>
    </div>
  );
}
