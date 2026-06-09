'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cpu, RefreshCw, Search } from 'lucide-react';

type SortKey = 'id' | 'context_window' | 'owned_by';

export default function ModelsModule() {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('id');

  async function load() {
    setLoading(true);
    const r = await fetch('/api/models');
    const j = await r.json();
    setModels(j.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const owners = useMemo(() => {
    const set = new Set<string>();
    models.forEach((m) => m.owned_by && set.add(m.owned_by));
    return Array.from(set).sort();
  }, [models]);

  const filtered = useMemo(() => {
    let list = models.filter((m) => {
      if (owner !== 'all' && m.owned_by !== owner) return false;
      if (search && !m.id?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === 'context_window') return (b.context_window || 0) - (a.context_window || 0);
      if (sortBy === 'owned_by') return (a.owned_by || '').localeCompare(b.owned_by || '');
      return (a.id || '').localeCompare(b.id || '');
    });
    return list;
  }, [models, search, owner, sortBy]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-medium flex items-center gap-2"><Cpu className="w-5 h-5" /> Available Models</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2.5 text-gray-500 dark:text-groq-muted" />
            <input className="input pl-7 w-56 text-xs" placeholder="Search models..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select aria-label="Owner filter" className="input text-xs" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="all">All owners</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select aria-label="Sort" className="input text-xs" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
            <option value="id">Sort: id</option>
            <option value="context_window">Sort: context size</option>
            <option value="owned_by">Sort: owner</option>
          </select>
          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-groq-muted">{filtered.length} of {models.length} models</div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((m) => (
          <div key={m.id} className="panel p-4 hover:border-groq-orange/40 transition-colors">
            <div className="font-mono text-sm font-medium text-groq-orange break-all">{m.id}</div>
            <div className="text-xs text-gray-500 dark:text-groq-muted mt-1">Owner: {m.owned_by}</div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`badge ${m.active ? 'border-green-500/50 text-green-400' : 'border-gray-500/50'}`}>
                {m.active ? 'active' : 'inactive'}
              </span>
              {m.context_window && <span className="badge">ctx: {m.context_window.toLocaleString()}</span>}
              {m.max_completion_tokens && <span className="badge">max: {m.max_completion_tokens.toLocaleString()}</span>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full panel p-8 text-center text-gray-500 dark:text-groq-muted text-sm">No models match</div>
        )}
      </div>
    </div>
  );
}
