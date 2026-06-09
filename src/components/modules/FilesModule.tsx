'use client';

import { useEffect, useState } from 'react';
import { Upload, Trash2, RefreshCw, Search } from 'lucide-react';

export default function FilesModule() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [purpose, setPurpose] = useState('batch');
  const [search, setSearch] = useState('');
  const [filterPurpose, setFilterPurpose] = useState('all');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/files');
      const j = await r.json();
      setFiles(j.data || []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    fd.append('purpose', purpose);
    setLoading(true);
    await fetch('/api/files', { method: 'POST', body: fd });
    await load();
  }

  async function remove(id: string) {
    if (!confirm(`Delete file ${id}?`)) return;
    await fetch('/api/files', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await load();
  }

  const filtered = files.filter((f) => {
    if (filterPurpose !== 'all' && f.purpose !== filterPurpose) return false;
    if (search && !f.filename?.toLowerCase().includes(search.toLowerCase()) &&
        !f.id?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <select aria-label="Upload purpose" className="input w-40" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            <option value="batch">batch</option>
            <option value="fine-tune">fine-tune</option>
          </select>
          <label className="btn-primary cursor-pointer flex items-center gap-2">
            <Upload className="w-4 h-4" /> Upload JSONL
            <input type="file" accept=".jsonl,.json" onChange={upload} className="hidden" />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2.5 text-gray-500 dark:text-groq-muted" />
            <input className="input pl-7 w-56 text-xs" placeholder="Search by name or id..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select aria-label="Filter by purpose" className="input text-xs" value={filterPurpose}
            onChange={(e) => setFilterPurpose(e.target.value)}>
            <option value="all">All purposes</option>
            <option value="batch">batch</option>
            <option value="fine-tune">fine-tune</option>
          </select>
          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-groq-muted">{filtered.length} of {files.length} files</div>

      <div className="panel">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 dark:border-groq-border">
            <tr className="text-left text-xs text-gray-500 dark:text-groq-muted uppercase">
              <th className="p-3">ID</th>
              <th className="p-3">Filename</th>
              <th className="p-3">Purpose</th>
              <th className="p-3">Bytes</th>
              <th className="p-3">Status</th>
              <th className="p-3">Created</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500 dark:text-groq-muted">No files match</td></tr>
            )}
            {filtered.map((f) => (
              <tr key={f.id} className="border-b border-gray-200 dark:border-groq-border/50 hover:bg-gray-100 dark:bg-groq-panel/50">
                <td className="p-3 font-mono text-xs">{f.id}</td>
                <td className="p-3">{f.filename}</td>
                <td className="p-3"><span className="badge">{f.purpose}</span></td>
                <td className="p-3">{f.bytes}</td>
                <td className="p-3"><span className="badge">{f.status}</span></td>
                <td className="p-3 text-xs text-gray-500 dark:text-groq-muted">
                  {new Date(f.created_at * 1000).toLocaleString()}
                </td>
                <td className="p-3">
                  <button onClick={() => remove(f.id)} aria-label="Delete file" className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
