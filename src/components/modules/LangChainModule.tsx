'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Trash2, Loader2, Wrench, ChevronDown, ChevronRight, Sparkles, Lightbulb, Square, Download, BookOpen, Plus, X, MessageSquare, Edit2, Copy, RefreshCw, Check, GitBranch, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GROQ_MODELS } from '@/lib/groq-models';
import { estimateCost, formatCost } from '@/lib/pricing';

type Step = { type: string; name?: string; args?: any; content?: string };
type Usage = { input_tokens: number; output_tokens: number };
type Msg = { role: 'user' | 'assistant'; content: string; steps?: Step[]; usage?: Usage };
type ToolInfo = { name: string; description: string };
type Thread = { id: string; title: string; messages: Msg[]; createdAt: number; updatedAt: number };

const STORAGE_KEY = 'groq:langchain:history'; // legacy single-thread
const THREADS_KEY = 'groq:langchain:threads';
const ACTIVE_KEY = 'groq:langchain:active';

function newThreadId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeEmptyThread(): Thread {
  const now = Date.now();
  return { id: newThreadId(), title: 'New chat', messages: [], createdAt: now, updatedAt: now };
}

const FALLBACK_TOOLS: ToolInfo[] = [
  { name: 'calculator', description: 'Math expressions' },
  { name: 'web_search', description: 'DuckDuckGo search' },
  { name: 'fetch_url', description: 'Read text from a URL' },
  { name: 'code_exec', description: 'Run JS code' },
  { name: 'datetime', description: 'Current date/time in any timezone' },
  { name: 'weather', description: 'Current weather (Open-Meteo)' },
  { name: 'knowledge_search', description: 'Search uploaded documents' },
];

const PRESETS: { label: string; prompt: string }[] = [
  { label: 'Math + research', prompt: 'What is 234 × 567, and then briefly explain who Ada Lovelace was.' },
  { label: 'Read a URL', prompt: 'Fetch https://example.com and summarize what you find in 2 sentences.' },
  { label: 'JS data transform', prompt: 'Use code_exec to compute the sum of squares from 1 to 50 and explain the result.' },
  { label: 'Compare facts', prompt: 'Search for the population of São Paulo and Tokyo, then tell me which is larger and by how much.' },
];

export default function LangChainModule() {
  const [model, setModel] = useState(GROQ_MODELS.chat[0]);
  const [availableModels, setAvailableModels] = useState<string[]>(GROQ_MODELS.chat);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [system, setSystem] = useState(
    'You are a capable AI agent. Use the provided tools when helpful, and briefly explain which tool you used.'
  );
  const [temperature, setTemperature] = useState(0.3);
  const [maxIterations, setMaxIterations] = useState(6);
  const [streaming, setStreaming] = useState(true);
  const [tools, setTools] = useState<ToolInfo[]>(FALLBACK_TOOLS);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    calculator: true, web_search: true, fetch_url: true, code_exec: true, datetime: true, weather: true, knowledge_search: true,
  });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Knowledge base state
  type KBChunk = { id: string; source: string; preview: string; length: number };
  const [kb, setKb] = useState<KBChunk[]>([]);
  const [kbOpen, setKbOpen] = useState(false);
  const [kbSource, setKbSource] = useState('');
  const [kbText, setKbText] = useState('');
  const [kbBusy, setKbBusy] = useState(false);

  async function loadKB() {
    try {
      const r = await fetch('/api/langchain/knowledge');
      const d = await r.json();
      setKb(d.chunks || []);
    } catch {}
  }

  useEffect(() => { loadKB(); }, []);

  async function addKB() {
    if (!kbText.trim() || kbBusy) return;
    setKbBusy(true);
    try {
      await fetch('/api/langchain/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: kbSource || 'untitled', text: kbText }),
      });
      setKbSource('');
      setKbText('');
      await loadKB();
    } finally { setKbBusy(false); }
  }

  async function removeKB(id: string) {
    await fetch(`/api/langchain/knowledge?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadKB();
  }

  async function clearKB() {
    if (!confirm('Clear the entire knowledge base?')) return;
    await fetch('/api/langchain/knowledge', { method: 'DELETE' });
    await loadKB();
  }

  async function uploadFile(file: File) {
    const text = await file.text();
    setKbBusy(true);
    try {
      await fetch('/api/langchain/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: file.name, text }),
      });
      await loadKB();
    } finally { setKbBusy(false); }
  }

  useEffect(() => {
    fetch('/api/langchain/agent')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.tools)) setTools(d.tools); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const rawT = localStorage.getItem(THREADS_KEY);
      const rawA = localStorage.getItem(ACTIVE_KEY);
      let loaded: Thread[] = rawT ? JSON.parse(rawT) : [];
      let active = rawA || '';
      if (!loaded.length) {
        // Migrate legacy single-thread history
        const legacy = localStorage.getItem(STORAGE_KEY);
        if (legacy) {
          const msgs: Msg[] = JSON.parse(legacy);
          if (Array.isArray(msgs) && msgs.length) {
            const first = msgs.find((m) => m.role === 'user')?.content || 'Imported chat';
            const t: Thread = {
              id: newThreadId(),
              title: first.slice(0, 40),
              messages: msgs,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            loaded = [t];
            active = t.id;
          }
        }
      }
      if (!loaded.length) {
        const t = makeEmptyThread();
        loaded = [t];
        active = t.id;
      }
      if (!active || !loaded.some((t) => t.id === active)) active = loaded[0].id;
      setThreads(loaded);
      setActiveId(active);
      setMessages(loaded.find((t) => t.id === active)?.messages || []);
    } catch {
      const t = makeEmptyThread();
      setThreads([t]);
      setActiveId(t.id);
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current || !activeId) return;
    setThreads((arr) => {
      const updated = arr.map((t) => t.id === activeId ? { ...t, messages: messages.slice(-100), updatedAt: Date.now() } : t);
      try {
        localStorage.setItem(THREADS_KEY, JSON.stringify(updated));
        localStorage.setItem(ACTIVE_KEY, activeId);
      } catch {}
      return updated;
    });
  }, [messages, activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        newThread();
      } else if (e.key === 'Escape') {
        if (searchOpen) setSearchOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen]);

  // Load real models from Groq API (dynamic)
  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    fetch('/api/models')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const list = Array.isArray(j?.data) ? j.data : [];
        // Filter to chat-capable text models: exclude whisper/tts/guard/vision-only
        const ids = list
          .filter((m: any) => m?.active !== false)
          .map((m: any) => m?.id as string)
          .filter((id: string) => typeof id === 'string')
          .filter((id: string) => !/whisper|tts|playai|guard/i.test(id));
        if (ids.length) {
          setAvailableModels(ids);
          // Keep current selection if still available, else default to first
          setModel((prev) => ids.includes(prev) ? prev : ids[0]);
        }
      })
      .catch(() => { /* keep fallback list */ })
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function updateLastAssistant(updater: (m: Msg) => Msg) {
    setMessages((arr) => {
      if (!arr.length) return arr;
      const last = arr[arr.length - 1];
      if (last.role !== 'assistant') return arr;
      return [...arr.slice(0, -1), updater(last)];
    });
  }

  async function send() {
    if (!input.trim() || loading) return;
    const userText = input;
    setInput('');
    await sendWith(userText, messages);
  }

  async function sendWith(userText: string, baseMessages: Msg[]) {
    if (!userText.trim() || loading) return;
    const userMsg: Msg = { role: 'user', content: userText };
    const next = [...baseMessages, userMsg];
    setMessages(next);
    setLoading(true);

    // Auto-title: first user message in this thread
    const isFirstUser = !baseMessages.some((m) => m.role === 'user');
    if (isFirstUser) {
      const title = userText.replace(/\s+/g, ' ').trim().slice(0, 40) || 'New chat';
      setThreads((arr) => arr.map((t) => t.id === activeId && t.title === 'New chat' ? { ...t, title } : t));
    }

    const enabledTools = Object.entries(enabled).filter(([, v]) => v).map(([k]) => k);
    const payload = {
      model, system, temperature,
      max_iterations: maxIterations,
      tools: enabledTools,
      messages: next.map((m) => ({ role: m.role, content: m.content })),
      stream: streaming,
    };

    try {
      if (streaming) {
        setMessages((m) => [...m, { role: 'assistant', content: '', steps: [] }]);

        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const res = await fetch('/api/langchain/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const errTxt = await res.text().catch(() => 'Stream error');
          updateLastAssistant((m) => ({ ...m, content: `❌ ${errTxt}` }));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';
          for (const evt of events) {
            const lines = evt.split('\n');
            const eventLine = lines.find((l) => l.startsWith('event: '));
            const dataLine = lines.find((l) => l.startsWith('data: '));
            if (!eventLine || !dataLine) continue;
            const type = eventLine.slice(7).trim();
            let data: any;
            try { data = JSON.parse(dataLine.slice(6)); } catch { continue; }
            if (type === 'token') {
              updateLastAssistant((m) => ({ ...m, content: m.content + data }));
            } else if (type === 'tool_call') {
              updateLastAssistant((m) => ({
                ...m,
                steps: [...(m.steps || []), { type: 'tool_call', name: data.name, args: data.args }],
              }));
            } else if (type === 'tool_result') {
              updateLastAssistant((m) => ({
                ...m,
                steps: [...(m.steps || []), { type: 'tool_result', name: data.name, content: data.content }],
              }));
            } else if (type === 'usage') {
              updateLastAssistant((m) => ({ ...m, usage: data }));
            } else if (type === 'error') {
              updateLastAssistant((m) => ({ ...m, content: `❌ ${data?.message || 'Stream error'}` }));
            }
          }
        }
      } else {
        const res = await fetch('/api/langchain/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessages((m) => [...m, { role: 'assistant', content: `❌ ${data.error || 'Agent error'}` }]);
        } else {
          setMessages((m) => [...m, { role: 'assistant', content: data.output || '(empty)', steps: data.steps || [], usage: data.usage }]);
        }
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        updateLastAssistant((m) => ({ ...m, content: m.content + '\n\n_(stopped)_' }));
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: `❌ ${e?.message || 'Network error'}` }]);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function exportConversation() {
    const lines = messages.map((m) => `## ${m.role.toUpperCase()}\n\n${m.content}${m.steps?.length ? `\n\n<details><summary>${m.steps.length} tool step(s)</summary>\n\n${m.steps.map((s) => `- **${s.type}** ${s.name || ''} ${s.args ? JSON.stringify(s.args) : ''}${s.content ? `\n  → ${s.content}` : ''}`).join('\n')}\n</details>` : ''}`);
    const md = `# LangChain Agent Conversation\n\nExported: ${new Date().toISOString()}\nModel: ${model}\n\n${lines.join('\n\n---\n\n')}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `langchain-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clear() {
    setMessages([]);
    setExpanded({});
  }

  function newThread() {
    const t = makeEmptyThread();
    setThreads((arr) => [t, ...arr]);
    setActiveId(t.id);
    setMessages([]);
    setExpanded({});
  }

  function switchThread(id: string) {
    if (id === activeId) return;
    const t = threads.find((x) => x.id === id);
    if (!t) return;
    setActiveId(id);
    setMessages(t.messages);
    setExpanded({});
  }

  function deleteThread(id: string) {
    setThreads((arr) => {
      const filtered = arr.filter((t) => t.id !== id);
      if (!filtered.length) {
        const t = makeEmptyThread();
        setActiveId(t.id);
        setMessages([]);
        return [t];
      }
      if (id === activeId) {
        setActiveId(filtered[0].id);
        setMessages(filtered[0].messages);
      }
      return filtered;
    });
  }

  function renameThread(id: string, title: string) {
    setThreads((arr) => arr.map((t) => t.id === id ? { ...t, title: title.slice(0, 60) || 'Untitled' } : t));
    setRenamingId(null);
  }

  function forkThread(uptoIdx: number) {
    // Branch the current thread: create a new thread with messages[0..uptoIdx]
    const slice = messages.slice(0, uptoIdx + 1);
    if (!slice.length) return;
    const current = threads.find((t) => t.id === activeId);
    const baseTitle = current?.title || 'Chat';
    const t: Thread = {
      id: newThreadId(),
      title: `${baseTitle} (fork)`.slice(0, 60),
      messages: slice,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setThreads((arr) => [t, ...arr]);
    setActiveId(t.id);
    setMessages(slice);
    setExpanded({});
  }

  async function copyMessage(idx: number) {
    try {
      await navigator.clipboard.writeText(messages[idx]?.content || '');
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((v) => v === idx ? null : v), 1500);
    } catch {}
  }

  async function regenerate() {
    if (loading || !messages.length) return;
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;
    const lastUser = messages[lastUserIdx].content;
    const base = messages.slice(0, lastUserIdx);
    setMessages(base);
    await sendWith(lastUser, base);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 dark:border-groq-border px-4 py-3 flex items-center justify-between bg-gray-100 dark:bg-groq-panel">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-groq-orange" />
          <h2 className="font-semibold text-sm">LangChain Agent</h2>
          <span className="text-[10px] text-gray-500 dark:text-groq-muted bg-gray-200 dark:bg-groq-dark px-2 py-0.5 rounded">
            {Object.values(enabled).filter(Boolean).length} tools
          </span>
          {streaming && (
            <span className="text-[10px] text-groq-orange bg-gray-200 dark:bg-groq-dark px-2 py-0.5 rounded">streaming</span>
          )}
          {(() => {
            const totalIn = messages.reduce((s, m) => s + (m.usage?.input_tokens || 0), 0);
            const totalOut = messages.reduce((s, m) => s + (m.usage?.output_tokens || 0), 0);
            if (!totalIn && !totalOut) return null;
            return (
              <span className="text-[10px] text-gray-500 dark:text-groq-muted bg-gray-200 dark:bg-groq-dark px-2 py-0.5 rounded" title="Session totals">
                {totalIn + totalOut} tok · {formatCost(estimateCost(model, totalIn, totalOut))}
              </span>
            );
          })()}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSearchOpen(true)}
            className="text-gray-500 dark:text-groq-muted hover:text-white p-1.5 rounded"
            title="Search threads (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={exportConversation}
            disabled={!messages.length}
            className="text-gray-500 dark:text-groq-muted hover:text-white p-1.5 rounded disabled:opacity-30"
            title="Export as Markdown"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={clear}
            className="text-gray-500 dark:text-groq-muted hover:text-white p-1.5 rounded"
            title="Clear conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 border-r border-gray-200 dark:border-groq-border overflow-y-auto p-4 space-y-4 bg-gray-100 dark:bg-groq-panel/50 shrink-0">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-gray-500 dark:text-groq-muted uppercase tracking-wide flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Threads ({threads.length})
              </label>
              <button
                onClick={newThread}
                className="text-[10px] text-groq-orange hover:text-white flex items-center gap-1"
                title="New thread"
              >
                <Plus className="w-3 h-3" /> New
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {threads.map((t) => (
                <div
                  key={t.id}
                  className={`group flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer ${
                    t.id === activeId ? 'bg-groq-orange/20 text-white' : 'hover:bg-gray-200 dark:bg-groq-dark text-gray-500 dark:text-groq-muted hover:text-white'
                  }`}
                  onClick={() => switchThread(t.id)}
                >
                  {renamingId === t.id ? (
                    <input
                      autoFocus
                      aria-label="Rename thread"
                      title="Thread title"
                      placeholder="Title"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => renameThread(t.id, renameValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameThread(t.id, renameValue);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 bg-gray-200 dark:bg-groq-dark border border-groq-orange rounded px-1 py-0.5 text-xs"
                    />
                  ) : (
                    <span className="flex-1 truncate" title={t.title}>{t.title}</span>
                  )}
                  <span className="text-[9px] text-gray-500 dark:text-groq-muted/70">{t.messages.length}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRenamingId(t.id); setRenameValue(t.title); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 dark:text-groq-muted hover:text-white"
                    title="Rename"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${t.title}"?`)) deleteThread(t.id); }}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                    title="Delete"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] text-gray-500 dark:text-groq-muted uppercase tracking-wide flex items-center gap-1">
              Model
              {modelsLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              <span className="text-gray-500 dark:text-groq-muted/60 ml-auto">{availableModels.length}</span>
            </label>
            <select
              aria-label="Model"
              title="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full mt-1 bg-gray-200 dark:bg-groq-dark border border-gray-200 dark:border-groq-border rounded px-2 py-1.5 text-sm"
            >
              {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-gray-500 dark:text-groq-muted uppercase tracking-wide">
              Temperature: {temperature}
            </label>
            <input
              aria-label="Temperature"
              title="Temperature"
              type="range" min={0} max={1} step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-[11px] text-gray-500 dark:text-groq-muted uppercase tracking-wide">
              Max iterations: {maxIterations}
            </label>
            <input
              aria-label="Max iterations"
              title="Max iterations"
              type="range" min={1} max={15} step={1}
              value={maxIterations}
              onChange={(e) => setMaxIterations(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={streaming}
              onChange={(e) => setStreaming(e.target.checked)}
            />
            <span>Stream responses (SSE)</span>
          </label>

          <div>
            <label className="text-[11px] text-gray-500 dark:text-groq-muted uppercase tracking-wide">System prompt</label>
            <textarea
              aria-label="System prompt"
              placeholder="System prompt"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              rows={4}
              className="w-full mt-1 bg-gray-200 dark:bg-groq-dark border border-gray-200 dark:border-groq-border rounded px-2 py-1.5 text-xs resize-none"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setKbOpen((v) => !v)}
              className="w-full flex items-center justify-between text-[11px] text-gray-500 dark:text-groq-muted uppercase tracking-wide hover:text-white"
            >
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Knowledge ({kb.length})
              </span>
              {kbOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {kbOpen && (
              <div className="mt-2 space-y-2">
                <input
                  aria-label="Source name"
                  type="text"
                  placeholder="Source name (optional)"
                  value={kbSource}
                  onChange={(e) => setKbSource(e.target.value)}
                  className="w-full bg-gray-200 dark:bg-groq-dark border border-gray-200 dark:border-groq-border rounded px-2 py-1 text-xs"
                />
                <textarea
                  aria-label="Knowledge text"
                  placeholder="Paste text or notes…"
                  value={kbText}
                  onChange={(e) => setKbText(e.target.value)}
                  rows={4}
                  className="w-full bg-gray-200 dark:bg-groq-dark border border-gray-200 dark:border-groq-border rounded px-2 py-1 text-xs resize-none"
                />
                <div className="flex gap-1">
                  <button
                    onClick={addKB}
                    disabled={kbBusy || !kbText.trim()}
                    className="flex-1 bg-groq-orange/80 hover:bg-groq-orange text-white text-xs py-1 rounded flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                  <label className="flex-1 cursor-pointer bg-gray-200 dark:bg-groq-dark border border-gray-200 dark:border-groq-border hover:border-groq-orange/60 text-xs py-1 rounded flex items-center justify-center gap-1">
                    Upload
                    <input
                      type="file"
                      accept=".txt,.md,.json,.csv"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }}
                    />
                  </label>
                </div>
                {kb.length > 0 && (
                  <>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {kb.map((c) => (
                        <div key={c.id} className="text-[10px] bg-gray-200 dark:bg-groq-dark/60 rounded px-2 py-1 flex items-start gap-1 group">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-blue-300 truncate">{c.source}</div>
                            <div className="text-gray-500 dark:text-groq-muted truncate">{c.preview}…</div>
                          </div>
                          <button
                            onClick={() => removeKB(c.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                            title="Remove"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={clearKB}
                      className="w-full text-[10px] text-red-400 hover:text-red-300 py-0.5"
                    >
                      Clear all
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] text-gray-500 dark:text-groq-muted uppercase tracking-wide flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Tools
            </label>
            <div className="mt-2 space-y-2">
              {tools.map((t) => (
                <label key={t.name} className="flex items-start gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!enabled[t.name]}
                    onChange={(e) => setEnabled((s) => ({ ...s, [t.name]: e.target.checked }))}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-gray-500 dark:text-groq-muted text-[10px] leading-tight">{t.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 dark:text-groq-muted text-sm py-12">
                <Sparkles className="w-8 h-8 mx-auto mb-3 text-groq-orange opacity-50" />
                <p>Ask the agent anything. It can do math, search the web, fetch URLs, and run JS.</p>
                <div className="mt-6 max-w-md mx-auto grid grid-cols-1 gap-2 text-left">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setInput(p.prompt)}
                      className="flex items-start gap-2 text-xs bg-gray-100 dark:bg-groq-panel border border-gray-200 dark:border-groq-border hover:border-groq-orange/60 rounded px-3 py-2 transition"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-groq-orange shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">{p.label}</div>
                        <div className="text-gray-500 dark:text-groq-muted">{p.prompt}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`group flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.role === 'user' ? 'bg-groq-orange text-white' : 'bg-gray-100 dark:bg-groq-panel border border-gray-200 dark:border-groq-border'
                }`}>
                  {m.steps && m.steps.length > 0 && (
                    <button
                      onClick={() => setExpanded((s) => ({ ...s, [i]: !s[i] }))}
                      className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-groq-muted hover:text-white mb-2"
                    >
                      {expanded[i] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {m.steps.length} tool step{m.steps.length === 1 ? '' : 's'}
                    </button>
                  )}
                  {m.steps && expanded[i] && (
                    <div className="mb-2 space-y-1">
                      {m.steps.map((s, j) => (
                        <div key={j} className="text-[10px] bg-gray-200 dark:bg-groq-dark/60 rounded px-2 py-1 font-mono">
                          <span className="text-groq-orange">{s.type}</span>
                          {s.name && <span className="text-blue-300"> {s.name}</span>}
                          {s.args && <div className="text-gray-500 dark:text-groq-muted truncate">{JSON.stringify(s.args)}</div>}
                          {s.content && <div className="text-gray-500 dark:text-groq-muted truncate">→ {s.content}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="break-words text-sm">
                    {m.role === 'assistant' && m.content ? (
                      <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-gray-200 dark:bg-groq-dark prose-pre:text-xs prose-code:text-groq-orange prose-code:before:content-none prose-code:after:content-none prose-a:text-groq-orange">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">
                        {m.content || (loading && i === messages.length - 1 ? '…' : '')}
                      </span>
                    )}
                  </div>
                  {m.role === 'assistant' && m.usage && (m.usage.input_tokens || m.usage.output_tokens) ? (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-groq-border/50 text-[10px] text-gray-500 dark:text-groq-muted flex items-center gap-2 flex-wrap">
                      <span title="Input tokens">↓ {m.usage.input_tokens}</span>
                      <span title="Output tokens">↑ {m.usage.output_tokens}</span>
                      <span className="text-gray-500 dark:text-groq-muted/70">
                        {formatCost(estimateCost(model, m.usage.input_tokens, m.usage.output_tokens))}
                      </span>
                    </div>
                  ) : null}
                  {m.content && !loading && (
                    <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyMessage(i)}
                        className="text-[10px] text-gray-500 dark:text-groq-muted hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-200 dark:bg-groq-dark"
                        title="Copy"
                      >
                        {copiedIdx === i ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        {copiedIdx === i ? 'Copied' : 'Copy'}
                      </button>
                      {m.role === 'assistant' && i === messages.length - 1 && (
                        <button
                          onClick={regenerate}
                          className="text-[10px] text-gray-500 dark:text-groq-muted hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-200 dark:bg-groq-dark"
                          title="Regenerate"
                        >
                          <RefreshCw className="w-3 h-3" /> Regenerate
                        </button>
                      )}
                      {i < messages.length - 1 && (
                        <button
                          onClick={() => forkThread(i)}
                          className="text-[10px] text-gray-500 dark:text-groq-muted hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-200 dark:bg-groq-dark"
                          title="Fork thread from here"
                        >
                          <GitBranch className="w-3 h-3" /> Fork
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-groq-panel border border-gray-200 dark:border-groq-border rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-gray-500 dark:text-groq-muted">
                  <Loader2 className="w-4 h-4 animate-spin" /> Agent thinking…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-groq-border p-3 flex gap-2 bg-gray-100 dark:bg-groq-panel">
            <textarea
              aria-label="Message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Ask the agent…"
              rows={2}
              className="flex-1 bg-gray-200 dark:bg-groq-dark border border-gray-200 dark:border-groq-border rounded px-3 py-2 text-sm resize-none"
            />
            <button
              onClick={loading ? stop : send}
              disabled={!loading && !input.trim()}
              className={`${loading ? 'bg-red-500 hover:bg-red-600' : 'bg-groq-orange hover:bg-groq-orange/90'} disabled:opacity-40 text-white px-4 rounded flex items-center gap-1.5 text-sm`}
            >
              {loading ? <Square className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {loading ? 'Stop' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {searchOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-20"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="bg-gray-100 dark:bg-groq-panel border border-gray-200 dark:border-groq-border rounded-lg w-full max-w-2xl max-h-[70vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 dark:border-groq-border p-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500 dark:text-groq-muted" />
              <input
                autoFocus
                aria-label="Search threads"
                placeholder="Search across all threads…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm"
              />
              <kbd className="text-[10px] text-gray-500 dark:text-groq-muted bg-gray-200 dark:bg-groq-dark px-1.5 py-0.5 rounded">Esc</kbd>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {(() => {
                const q = searchQuery.trim().toLowerCase();
                type Hit = { thread: Thread; msgIdx: number; preview: string };
                const hits: Hit[] = [];
                for (const t of threads) {
                  if (!q) {
                    hits.push({ thread: t, msgIdx: -1, preview: t.messages[0]?.content?.slice(0, 120) || '(empty)' });
                    continue;
                  }
                  const titleMatch = t.title.toLowerCase().includes(q);
                  let added = false;
                  t.messages.forEach((m, idx) => {
                    if (m.content.toLowerCase().includes(q)) {
                      const start = Math.max(0, m.content.toLowerCase().indexOf(q) - 30);
                      hits.push({ thread: t, msgIdx: idx, preview: m.content.slice(start, start + 160) });
                      added = true;
                    }
                  });
                  if (titleMatch && !added) {
                    hits.push({ thread: t, msgIdx: -1, preview: t.messages[0]?.content?.slice(0, 120) || '(empty)' });
                  }
                }
                if (!hits.length) {
                  return <div className="text-center text-gray-500 dark:text-groq-muted text-sm py-8">No matches</div>;
                }
                return hits.slice(0, 50).map((h, i) => (
                  <button
                    key={`${h.thread.id}-${h.msgIdx}-${i}`}
                    onClick={() => { switchThread(h.thread.id); setSearchOpen(false); setSearchQuery(''); }}
                    className="w-full text-left p-2 rounded hover:bg-gray-200 dark:bg-groq-dark border border-transparent hover:border-gray-200 dark:border-groq-border block mb-1"
                  >
                    <div className="text-xs font-medium text-white truncate flex items-center gap-2">
                      <MessageSquare className="w-3 h-3 text-groq-orange shrink-0" />
                      {h.thread.title}
                      {h.msgIdx >= 0 && (
                        <span className="text-[10px] text-gray-500 dark:text-groq-muted">msg #{h.msgIdx + 1}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-groq-muted truncate mt-0.5">{h.preview}</div>
                  </button>
                ));
              })()}
            </div>
            <div className="border-t border-gray-200 dark:border-groq-border px-3 py-2 text-[10px] text-gray-500 dark:text-groq-muted flex items-center gap-3">
              <span><kbd className="bg-gray-200 dark:bg-groq-dark px-1 py-0.5 rounded">Ctrl+K</kbd> search</span>
              <span><kbd className="bg-gray-200 dark:bg-groq-dark px-1 py-0.5 rounded">Ctrl+Shift+O</kbd> new thread</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
