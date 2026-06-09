'use client';

import { useEffect, useState } from 'react';
import { Activity, RefreshCw, Trash2, Download, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 25;

export default function HistoryModule() {
  const [data, setData] = useState<{ logs: any[]; stats: any[] }>({ logs: [], stats: [] });
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [page, setPage] = useState(0);

  async function load() {
    const r = await fetch(`/api/history${filter ? `?module=${filter}&limit=500` : '?limit=500'}`);
    setData(await r.json());
    setPage(0);
  }

  useEffect(() => { load(); }, [filter]);

  async function clearAll() {
    if (!confirm('Clear all API logs?')) return;
    await fetch('/api/history', { method: 'DELETE' });
    await load();
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(data.logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `api-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const cols = ['id', 'created_at', 'module', 'endpoint', 'model', 'status_code', 'duration_ms', 'error'];
    const header = cols.join(',');
    const rows = data.logs.map((l: any) =>
      cols.map((c) => {
        const v = l[c] ?? '';
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `api-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(data.logs.length / PAGE_SIZE));
  const paged = data.logs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {data.stats?.map((s: any) => (
          <button key={s.module} onClick={() => setFilter(filter === s.module ? '' : s.module)}
            className={`panel p-3 text-left hover:border-groq-orange/50 ${filter === s.module ? 'border-groq-orange' : ''}`}>
            <div className="text-xs text-gray-500 dark:text-groq-muted uppercase">{s.module}</div>
            <div className="text-2xl font-bold">{s.count}</div>
            <div className="text-xs text-gray-500 dark:text-groq-muted">{s.avg_ms}ms avg</div>
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="text-sm text-gray-500 dark:text-groq-muted">
          {data.logs.length} logs {filter && `· filter: ${filter}`}
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-xs">
            <Download className="w-3 h-3" /> CSV
          </button>
          <button onClick={exportJSON} className="btn-secondary flex items-center gap-2 text-xs">
            <Download className="w-3 h-3" /> JSON
          </button>
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-xs">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <button onClick={clearAll} className="btn-ghost text-xs text-red-400 flex items-center gap-2">
            <Trash2 className="w-3 h-3" /> Clear all
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="panel max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-100 dark:bg-groq-panel border-b border-gray-200 dark:border-groq-border">
              <tr className="text-left text-gray-500 dark:text-groq-muted uppercase">
                <th className="p-2">Time</th>
                <th className="p-2">Module</th>
                <th className="p-2">Model</th>
                <th className="p-2">Status</th>
                <th className="p-2">ms</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((l: any) => (
                <tr key={l.id} onClick={() => setSelected(l)}
                  className={`border-b border-gray-200 dark:border-groq-border/30 cursor-pointer hover:bg-gray-100 dark:bg-groq-panel/70
                    ${selected?.id === l.id ? 'bg-groq-orange/10' : ''}`}>
                  <td className="p-2">{new Date(l.created_at).toLocaleTimeString()}</td>
                  <td className="p-2"><span className="badge">{l.module}</span></td>
                  <td className="p-2 font-mono text-[10px]">{l.model || '-'}</td>
                  <td className="p-2">
                    <span className={l.status_code === 200 ? 'text-green-400' : 'text-red-400'}>
                      {l.status_code || (l.error ? 'err' : '-')}
                    </span>
                  </td>
                  <td className="p-2">{l.duration_ms || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="border-t border-gray-200 dark:border-groq-border p-2 flex items-center justify-between sticky bottom-0 bg-gray-100 dark:bg-groq-panel">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                aria-label="Previous page" className="btn-ghost text-xs disabled:opacity-30">
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="text-xs text-gray-500 dark:text-groq-muted">Page {page + 1} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                aria-label="Next page" className="btn-ghost text-xs disabled:opacity-30">
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="panel p-4 max-h-[60vh] overflow-y-auto">
          {selected ? (
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {JSON.stringify(selected, null, 2)}
            </pre>
          ) : (
            <div className="text-gray-500 dark:text-groq-muted text-sm flex items-center gap-2 justify-center py-12">
              <Activity className="w-4 h-4" /> Select a log to inspect
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
