'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Plus, X, Search } from 'lucide-react';

export default function BatchesModule() {
  const [batches, setBatches] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [fileId, setFileId] = useState('');
  const [endpoint, setEndpoint] = useState('/v1/chat/completions');
  const [window, setWindow] = useState('24h');
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/batches');
    const j = await r.json();
    setBatches(j.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  async function create() {
    await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_file_id: fileId, endpoint, completion_window: window }),
    });
    setShowCreate(false); setFileId('');
    await load();
  }

  async function cancel(id: string) {
    if (!confirm(`Cancel batch ${id}?`)) return;
    await fetch('/api/batches', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await load();
  }

  const filtered = statusFilter === 'all' ? batches : batches.filter((b) => b.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Batch
        </button>
        <div className="flex items-center gap-2">
          <select aria-label="Status filter" className="input text-xs" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="validating">validating</option>
            <option value="in_progress">in_progress</option>
            <option value="finalizing">finalizing</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-groq-muted cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto 5s
          </label>
          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="panel p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Create Batch</h3>
            <button onClick={() => setShowCreate(false)} aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
          <div>
            <div className="label">Input File ID</div>
            <input className="input" placeholder="file-xxx (upload via Files tab)" value={fileId} onChange={(e) => setFileId(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label">Endpoint</div>
              <select className="input" value={endpoint} onChange={(e) => setEndpoint(e.target.value)}>
                <option>/v1/chat/completions</option>
                <option>/v1/audio/transcriptions</option>
                <option>/v1/audio/translations</option>
                <option>/v1/embeddings</option>
              </select>
            </div>
            <div>
              <div className="label">Completion window</div>
              <select className="input" value={window} onChange={(e) => setWindow(e.target.value)}>
                <option>24h</option>
                <option>48h</option>
                <option>72h</option>
                <option>7d</option>
              </select>
            </div>
          </div>
          <button onClick={create} disabled={!fileId} className="btn-primary">Create</button>
        </div>
      )}

      <div className="panel">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 dark:border-groq-border">
            <tr className="text-left text-xs text-gray-500 dark:text-groq-muted uppercase">
              <th className="p-3">ID</th>
              <th className="p-3">Status</th>
              <th className="p-3">Endpoint</th>
              <th className="p-3">Input File</th>
              <th className="p-3">Counts</th>
              <th className="p-3">Created</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500 dark:text-groq-muted">No batches</td></tr>
            )}
            {filtered.map((b) => (
              <tr key={b.id} className="border-b border-gray-200 dark:border-groq-border/50">
                <td className="p-3 font-mono text-xs">{b.id}</td>
                <td className="p-3"><span className="badge">{b.status}</span></td>
                <td className="p-3 text-xs">{b.endpoint}</td>
                <td className="p-3 text-xs">{b.input_file_id}</td>
                <td className="p-3 text-xs">
                  {b.request_counts && (
                    <>✓{b.request_counts.completed} ✗{b.request_counts.failed} /{b.request_counts.total}</>
                  )}
                </td>
                <td className="p-3 text-xs text-gray-500 dark:text-groq-muted">
                  {b.created_at && new Date(b.created_at * 1000).toLocaleString()}
                </td>
                <td className="p-3">
                  {['validating', 'in_progress', 'finalizing'].includes(b.status) && (
                    <button onClick={() => cancel(b.id)} className="btn-ghost text-xs text-red-400">Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
