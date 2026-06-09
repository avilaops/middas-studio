'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Loader2, RefreshCw, X, Copy, Check } from 'lucide-react';
import { GROQ_MODELS } from '@/lib/groq-models';
import { useGroqModels, isChatLikeModel } from '@/lib/use-groq-models';
import { estimateCost, formatCost } from '@/lib/pricing';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export default function ChatModule() {
  const availableModels = useGroqModels(isChatLikeModel, GROQ_MODELS.chat);
  const [model, setModel] = useState(GROQ_MODELS.chat[0]);
  const [system, setSystem] = useState('You are a helpful AI assistant.');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [topP, setTopP] = useState(1);
  const [stream, setStream] = useState(true);
  const [jsonMode, setJsonMode] = useState(false);
  const [useSchema, setUseSchema] = useState(false);
  const [schemaText, setSchemaText] = useState('{\n  "type": "object",\n  "properties": {\n    "answer": { "type": "string" }\n  },\n  "required": ["answer"]\n}');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<any>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function copyMessage(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1500);
    } catch {}
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Msg = { role: 'user', content: input };
    await runConversation([...messages, userMsg]);
    setInput('');
  }

  async function regenerate() {
    if (loading || messages.length === 0) return;
    let trimmed = [...messages];
    while (trimmed.length && trimmed[trimmed.length - 1].role === 'assistant') {
      trimmed.pop();
    }
    if (trimmed.length === 0) return;
    setMessages(trimmed);
    await runConversation(trimmed);
  }

  function deleteFrom(index: number) {
    setMessages((m) => m.slice(0, index));
  }

  async function runConversation(newMessages: Msg[]) {
    setMessages(newMessages);
    setLoading(true);

    let response_format: any = undefined;
    if (useSchema) {
      try {
        const schema = JSON.parse(schemaText);
        response_format = { type: 'json_schema', json_schema: { name: 'output', schema, strict: true } };
      } catch {
        setLoading(false);
        setMessages((m) => [...m, { role: 'assistant', content: '❌ Invalid JSON Schema' }]);
        return;
      }
    } else if (jsonMode) {
      response_format = { type: 'json_object' };
    }

    const payload = {
      model,
      messages: [{ role: 'system', content: system }, ...newMessages],
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      stream: useSchema ? false : stream,
      response_format,
    };

    try {
      if (stream) {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let assistant = '';
        setMessages((m) => [...m, { role: 'assistant', content: '' }]);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split('\n').filter(Boolean);
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.delta) {
                assistant += parsed.delta;
                setMessages((m) => {
                  const copy = [...m];
                  copy[copy.length - 1] = { role: 'assistant', content: assistant };
                  return copy;
                });
              }
            } catch {}
          }
        }
      } else {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setMessages((m) => [...m, { role: 'assistant', content: json.choices[0].message.content }]);
        setUsage({ ...json.usage, duration_ms: json.duration_ms });
      }
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', content: `❌ ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
      {/* Sidebar config */}
      <aside className="col-span-3 panel p-4 overflow-y-auto space-y-4">
        <div>
          <div className="label">Model</div>
          <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
            {availableModels.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <div className="label">System Prompt</div>
          <textarea className="input min-h-[100px]" value={system} onChange={(e) => setSystem(e.target.value)} />
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
        <div>
          <div className="label">Top P: {topP}</div>
          <input type="range" min={0} max={1} step={0.05} value={topP}
            onChange={(e) => setTopP(+e.target.value)} className="w-full accent-groq-orange" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)}
            className="accent-groq-orange" />
          Streaming
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={jsonMode} onChange={(e) => setJsonMode(e.target.checked)}
            className="accent-groq-orange" />
          JSON mode
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useSchema} onChange={(e) => setUseSchema(e.target.checked)}
            className="accent-groq-orange" />
          JSON Schema (structured)
        </label>
        {useSchema && (
          <div>
            <div className="label">Schema</div>
            <textarea aria-label="JSON Schema" className="input font-mono text-xs min-h-[150px]"
              value={schemaText} onChange={(e) => setSchemaText(e.target.value)} />
          </div>
        )}
        {usage && (
          <div className="text-xs text-gray-500 dark:text-groq-muted space-y-1 pt-3 border-t border-gray-200 dark:border-groq-border">
            <div>Prompt: {usage.prompt_tokens} tokens</div>
            <div>Completion: {usage.completion_tokens} tokens</div>
            <div>Total: {usage.total_tokens} tokens</div>
            <div>Latency: {usage.duration_ms}ms</div>
            <div className="text-groq-orange">Cost: {formatCost(estimateCost(model, usage.prompt_tokens || 0, usage.completion_tokens || 0))}</div>
          </div>
        )}
      </aside>

      {/* Chat area */}
      <section className="col-span-9 panel flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-groq-border">
          <div className="text-sm text-gray-500 dark:text-groq-muted">{messages.length} messages</div>
          <div className="flex gap-1">
            <button onClick={regenerate} disabled={loading || messages.length === 0}
              className="btn-ghost text-xs flex items-center gap-1 disabled:opacity-30">
              <RefreshCw className="w-3 h-3" /> Regenerate
            </button>
            <button onClick={() => { setMessages([]); setUsage(null); }} className="btn-ghost text-xs flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 dark:text-groq-muted text-sm py-12">
              Start a conversation. Streaming responses powered by Groq.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`group flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`relative max-w-[80%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap
                ${m.role === 'user' ? 'bg-groq-orange text-white' : 'bg-gray-100 dark:bg-groq-panel border border-gray-200 dark:border-groq-border'}`}>
                <button onClick={() => deleteFrom(i)} aria-label="Delete from here"
                  className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 w-5 h-5 rounded-full
                    bg-red-500 hover:bg-red-600 flex items-center justify-center transition-opacity">
                  <X className="w-3 h-3 text-white" />
                </button>
                {m.content && (
                  <button onClick={() => copyMessage(m.content, i)} aria-label="Copy message"
                    title={copiedIdx === i ? 'Copied!' : 'Copy'}
                    className={`opacity-0 group-hover:opacity-100 absolute -bottom-2 ${m.role === 'user' ? '-left-2' : '-right-2'} w-6 h-6 rounded-full
                      bg-gray-200 dark:bg-groq-dark border border-gray-300 dark:border-groq-border hover:border-groq-orange flex items-center justify-center transition-opacity`}>
                    {copiedIdx === i
                      ? <Check className="w-3 h-3 text-green-400" />
                      : <Copy className="w-3 h-3 text-gray-500 dark:text-groq-muted" />}
                  </button>
                )}
                {m.content || (loading && i === messages.length - 1 ? '...' : '')}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-groq-border flex gap-2">
          <textarea
            className="input flex-1 min-h-[44px] max-h-[120px] resize-none"
            placeholder="Type a message... (Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
          />
          <button onClick={send} disabled={loading || !input.trim()} className="btn-primary flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>
        </div>
      </section>
    </div>
  );
}
