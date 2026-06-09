'use client';

import { useEffect, useState } from 'react';
import { Wrench, Loader2 } from 'lucide-react';
import { GROQ_MODELS } from '@/lib/groq-models';
import { useGroqModels, isChatLikeModel } from '@/lib/use-groq-models';
import { estimateCost, formatCost } from '@/lib/pricing';

const DEFAULT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
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
];

export default function ToolsModule() {
  const availableModels = useGroqModels(isChatLikeModel, GROQ_MODELS.chat);
  const [model, setModel] = useState(GROQ_MODELS.chat[0]);
  const [prompt, setPrompt] = useState('What is the weather in Tokyo and what is 234 * 78?');
  const [toolsJson, setToolsJson] = useState(JSON.stringify(DEFAULT_TOOLS, null, 2));
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/tools').then((r) => r.json()).then((d) => setAvailable(d.available_tools || []));
  }, []);

  async function run() {
    setLoading(true); setResult(null);
    try {
      const tools = JSON.parse(toolsJson);
      const res = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          tools,
          tool_choice: 'auto',
        }),
      });
      setResult(await res.json());
    } catch (e: any) {
      setResult({ error: e.message });
    } finally { setLoading(false); }
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <aside className="col-span-5 panel p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div>
          <div className="label">Model</div>
          <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
            {availableModels.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <div className="label">Tools (JSON schema)</div>
          <textarea className="input font-mono text-xs min-h-[300px]"
            value={toolsJson} onChange={(e) => setToolsJson(e.target.value)} />
        </div>
        <div className="text-xs text-gray-500 dark:text-groq-muted">
          Server-side handlers available: <strong>{available.join(', ') || 'loading...'}</strong>
        </div>
        <div>
          <div className="label">User Message</div>
          <textarea className="input min-h-[80px]" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <button onClick={run} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          Run with tools
        </button>
      </aside>

      <section className="col-span-7 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
        {result?.error && <div className="panel p-4 text-red-400 text-sm">❌ {result.error}</div>}
        {result?.conversation && (
          <>
            <div className="text-xs text-gray-500 dark:text-groq-muted flex gap-3">
              <span>{result.iterations} iterations</span>
              <span>{result.duration_ms}ms</span>
              {result.usage && (
                <span className="text-groq-orange">Cost: {formatCost(estimateCost(model, result.usage.prompt_tokens || 0, result.usage.completion_tokens || 0))}</span>
              )}
            </div>
            {result.conversation.map((m: any, i: number) => (
              <div key={i} className="panel p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`badge ${
                    m.role === 'user' ? 'border-blue-500/50' :
                    m.role === 'assistant' ? 'border-groq-orange/50' :
                    m.role === 'tool' ? 'border-green-500/50' : ''
                  }`}>{m.role}</span>
                  {m.tool_calls && <span className="text-xs text-gray-500 dark:text-groq-muted">{m.tool_calls.length} tool call(s)</span>}
                </div>
                {m.content && (
                  <div className="text-sm whitespace-pre-wrap">
                    {typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}
                  </div>
                )}
                {m.tool_calls?.map((tc: any) => (
                  <div key={tc.id} className="mt-2 bg-gray-100 dark:bg-black/40 rounded p-2 text-xs font-mono">
                    <div className="text-groq-orange">{tc.function.name}</div>
                    <div className="text-gray-500 dark:text-groq-muted">{tc.function.arguments}</div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
