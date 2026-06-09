'use client';

import { useState } from 'react';
import { Languages, Loader2, Upload, Copy, Download } from 'lucide-react';

export default function TranslateModule() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [responseFormat, setResponseFormat] = useState('verbose_json');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!file) return;
    setLoading(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('model', 'whisper-large-v3');
      if (prompt) fd.append('prompt', prompt);
      fd.append('response_format', responseFormat);
      const res = await fetch('/api/audio/translate', { method: 'POST', body: fd });
      setResult(await res.json());
    } catch (e: any) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <aside className="col-span-4 panel p-4 space-y-4">
        <div className="text-sm text-gray-500 dark:text-groq-muted">
          Translates any audio language → English using whisper-large-v3.
        </div>
        <label className="btn-secondary cursor-pointer w-full flex items-center justify-center gap-2">
          <Upload className="w-4 h-4" /> {file ? file.name : 'Upload audio'}
          <input type="file" accept="audio/*,video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
        </label>
        <div>
          <div className="label">Prompt (optional)</div>
          <textarea className="input min-h-[60px]" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <div>
          <div className="label">Response format</div>
          <select className="input" value={responseFormat} onChange={(e) => setResponseFormat(e.target.value)}>
            <option value="json">json</option>
            <option value="text">text</option>
            <option value="verbose_json">verbose_json</option>
          </select>
        </div>
        <button onClick={run} disabled={!file || loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
          Translate to English
        </button>
      </aside>

      <section className="col-span-8 space-y-3">
        {result?.error && <div className="panel p-4 text-red-400 text-sm">❌ {result.error}</div>}
        {result?.text && (
          <div className="panel p-4">
            <div className="label flex items-center justify-between">
              <span>English translation</span>
              <div className="flex gap-1">
                <button onClick={() => navigator.clipboard.writeText(result.text)}
                  className="btn-ghost text-xs flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                <button onClick={() => {
                  const blob = new Blob([result.text], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `translation-${Date.now()}.txt`; a.click();
                  URL.revokeObjectURL(url);
                }} className="btn-ghost text-xs flex items-center gap-1"><Download className="w-3 h-3" /> TXT</button>
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap">{result.text}</div>
          </div>
        )}
      </section>
    </div>
  );
}
