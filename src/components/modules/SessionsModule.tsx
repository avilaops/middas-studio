'use client';

import { useEffect, useState } from 'react';
import { History, RefreshCw, Trash2, Search, Download } from 'lucide-react';

export default function SessionsModule() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  async function load() {
    const r = await fetch('/api/sessions');
    const j = await r.json();
    setSessions(j.sessions || []);
  }

  useEffect(() => { load(); }, []);

  async function open(id: number) {
    const r = await fetch(`/api/sessions/${id}`);
    const j = await r.json();
    setActive(j.session);
    setMessages(j.messages);
  }

  async function remove(id: number) {
    if (!confirm('Delete session?')) return;
    await fetch('/api/sessions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (active?.id === id) { setActive(null); setMessages([]); }
    await load();
  }

  function exportSession() {
    if (!active) return;
    const md = `# ${active.title}\n\nModel: ${active.model}\n\n` +
      messages.map((m) => `## ${m.role}\n\n${m.content}\n`).join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `session-${active.id}.md`; a.click();
    URL.revokeObjectURL(url);
  }

  const filteredSessions = sessions.filter((s) =>
    !search || s.title?.toLowerCase().includes(search.toLowerCase()) || s.model?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="grid grid-cols-12 gap-4">
      <aside className="col-span-4 panel max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="p-3 border-b border-gray-200 dark:border-groq-border space-y-2 sticky top-0 bg-gray-100 dark:bg-groq-panel z-10">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Sessions ({filteredSessions.length}/{sessions.length})</span>
            <button onClick={load} aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2.5 text-gray-500 dark:text-groq-muted" />
            <input className="input pl-7 w-full text-xs" placeholder="Search sessions..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {filteredSessions.map((s) => (
          <div key={s.id} onClick={() => open(s.id)}
            className={`p-3 border-b border-gray-200 dark:border-groq-border/30 cursor-pointer hover:bg-gray-100 dark:bg-groq-panel/70
              ${active?.id === s.id ? 'bg-groq-orange/10 border-l-2 border-l-groq-orange' : ''}`}>
            <div className="flex justify-between items-start">
              <div className="text-sm font-medium truncate flex-1">{s.title}</div>
              <button onClick={(e) => { e.stopPropagation(); remove(s.id); }} aria-label="Delete session" className="text-red-400 hover:text-red-300">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="text-xs text-gray-500 dark:text-groq-muted mt-1 flex justify-between">
              <span>{s.model}</span>
              <span>{s.message_count} msgs</span>
            </div>
            <div className="text-[10px] text-gray-500 dark:text-groq-muted">{new Date(s.updated_at).toLocaleString()}</div>
          </div>
        ))}
        {filteredSessions.length === 0 && <div className="p-8 text-center text-gray-500 dark:text-groq-muted text-sm">No sessions match</div>}
      </aside>

      <section className="col-span-8 panel p-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {active ? (
          <>
            <div className="border-b border-gray-200 dark:border-groq-border pb-3 mb-3 flex justify-between items-start">
              <div>
                <div className="font-medium">{active.title}</div>
                <div className="text-xs text-gray-500 dark:text-groq-muted">{active.model} · {messages.length} messages</div>
              </div>
              <button onClick={exportSession} className="btn-ghost text-xs flex items-center gap-1">
                <Download className="w-3 h-3" /> Export MD
              </button>
            </div>
            <div className="space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap
                    ${m.role === 'user' ? 'bg-groq-orange text-white' : 'bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-groq-border'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 dark:text-groq-muted py-12 flex flex-col items-center gap-2">
            <History className="w-8 h-8" /> Select a session
          </div>
        )}
      </section>
    </div>
  );
}
