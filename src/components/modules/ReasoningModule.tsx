'use client';

import { useState } from 'react';
import { Brain, Loader2, Copy } from 'lucide-react';
import { GROQ_MODELS } from '@/lib/groq-models';
import { useGroqModels, isReasoningModel } from '@/lib/use-groq-models';
import { estimateCost, formatCost } from '@/lib/pricing';

const PRESETS = [
  { label: 'Logic puzzle', text: 'A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?' },
  { label: 'Math', text: 'If 5 machines take 5 minutes to make 5 widgets, how long would 100 machines take to make 100 widgets?' },
  { label: 'Code debug', text: 'Why does this Python loop infinite loop?\n\nfor i in range(10):\n    print(i)\n    i = i - 1' },
  { label: 'Strategy', text: 'You have 3 boxes. One contains only apples, one only oranges, one both. All labels are wrong. You can pick one fruit from one box. How do you label all boxes correctly?' },
  { label: 'Sequence', text: 'What is the next number in the sequence: 2, 6, 12, 20, 30, ?' },
];

export default function ReasoningModule() {
  const availableModels = useGroqModels(isReasoningModel, GROQ_MODELS.reasoning);
  const [model, setModel] = useState(GROQ_MODELS.reasoning[0]);
  const [prompt, setPrompt] = useState('Quantos pessoas há em uma sala se 3 entram, 2 saem, depois entra o triplo das que ficaram?');
  const [format, setFormat] = useState<'parsed' | 'raw' | 'hidden'>('parsed');
  const [maxTokens, setMaxTokens] = useState(2048);
  const [temperature, setTemperature] = useState(0.6);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true); setResult(null);
    try {
      const res = await fetch('/api/reasoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, reasoning_format: format, max_tokens: maxTokens, temperature }),
      });
      setResult(await res.json());
    } catch (e: any) {
      setResult({ error: e.message });
    } finally { setLoading(false); }
  }

  const msg = result?.choices?.[0]?.message;

  return (
    <div className="grid grid-cols-12 gap-4">
      <aside className="col-span-4 panel p-4 space-y-4">
        <div>
          <div className="label">Reasoning Model</div>
          <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
            {availableModels.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <div className="label">Reasoning Format</div>
          <select className="input" value={format} onChange={(e) => setFormat(e.target.value as any)}>
            <option value="parsed">parsed (separate field)</option>
            <option value="raw">raw (in &lt;think&gt; tags)</option>
            <option value="hidden">hidden (only answer)</option>
          </select>
        </div>
        <div>
          <div className="label">Temperature: {temperature}</div>
          <input type="range" min={0} max={2} step={0.1} value={temperature}
            onChange={(e) => setTemperature(+e.target.value)} className="w-full accent-groq-orange" />
        </div>
        <div>
          <div className="label">Max tokens</div>
          <input type="number" className="input" value={maxTokens} onChange={(e) => setMaxTokens(+e.target.value)} />
        </div>
        <button onClick={run} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          Run reasoning
        </button>
      </aside>

      <section className="col-span-8 space-y-4">
        <div className="panel p-4">
          <div className="label flex items-center justify-between">
            <span>Prompt</span>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => setPrompt(p.text)}
                  className="btn-ghost text-[10px] px-2 py-1">{p.label}</button>
              ))}
            </div>
          </div>
          <textarea aria-label="Prompt" className="input min-h-[100px]" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        {result?.error && <div className="panel p-4 text-red-400 text-sm">❌ {result.error}</div>}
        {msg?.reasoning && (
          <div className="panel p-4">
            <div className="label flex items-center gap-2"><Brain className="w-3 h-3" /> Chain of Thought</div>
            <pre className="text-xs whitespace-pre-wrap text-gray-500 dark:text-groq-muted font-mono">{msg.reasoning}</pre>
          </div>
        )}
        {msg?.content && (
          <div className="panel p-4">
            <div className="label flex items-center justify-between">
              <span>Final Answer</span>
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
