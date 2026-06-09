'use client';

import { useRef, useState } from 'react';
import { Mic, MicOff, Loader2, Upload, Copy, Download } from 'lucide-react';
import { GROQ_MODELS } from '@/lib/groq-models';

function toSRT(segments: any[]): string {
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    const ms = Math.floor((s % 1) * 1000).toString().padStart(3, '0');
    return `${h}:${m}:${sec},${ms}`;
  };
  return segments.map((seg, i) =>
    `${i + 1}\n${fmt(seg.start)} --> ${fmt(seg.end)}\n${seg.text.trim()}\n`
  ).join('\n');
}
function toVTT(segments: any[]): string {
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toFixed(3).padStart(6, '0');
    return `${h}:${m}:${sec}`;
  };
  return 'WEBVTT\n\n' + segments.map((seg) =>
    `${fmt(seg.start)} --> ${fmt(seg.end)}\n${seg.text.trim()}\n`
  ).join('\n');
}
function download(name: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function TranscribeModule() {
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState(GROQ_MODELS.audio.transcription[0]);
  const [language, setLanguage] = useState('');
  const [prompt, setPrompt] = useState('');
  const [responseFormat, setResponseFormat] = useState('verbose_json');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const f = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        setFile(f);
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (e: any) {
      alert('Mic access denied: ' + e.message);
    }
  }

  function stopRec() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function run() {
    if (!file) return;
    setLoading(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('model', model);
      if (language) fd.append('language', language);
      if (prompt) fd.append('prompt', prompt);
      fd.append('response_format', responseFormat);
      const res = await fetch('/api/audio/transcribe', { method: 'POST', body: fd });
      setResult(await res.json());
    } catch (e: any) {
      setResult({ error: e.message });
    } finally { setLoading(false); }
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <aside className="col-span-4 panel p-4 space-y-4">
        <div>
          <div className="label">Model</div>
          <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
            {GROQ_MODELS.audio.transcription.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <label className="btn-secondary cursor-pointer w-full flex items-center justify-center gap-2">
          <Upload className="w-4 h-4" /> {file ? file.name.slice(0, 30) : 'Upload audio file'}
          <input type="file" accept="audio/*,video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
        </label>
        <div className="text-center text-xs text-gray-500 dark:text-groq-muted">— or record live —</div>
        {!recording ? (
          <button onClick={startRec} className="btn-secondary w-full flex items-center justify-center gap-2">
            <Mic className="w-4 h-4" /> Start recording
          </button>
        ) : (
          <button onClick={stopRec} className="btn w-full bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-2">
            <MicOff className="w-4 h-4" /> Stop recording
          </button>
        )}
        <div>
          <div className="label">Language (ISO 639-1, optional)</div>
          <input className="input" placeholder="pt, en, es..." value={language} onChange={(e) => setLanguage(e.target.value)} />
        </div>
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
            <option value="srt">srt</option>
            <option value="vtt">vtt</option>
          </select>
        </div>
        <button onClick={run} disabled={!file || loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
          Transcribe
        </button>
      </aside>

      <section className="col-span-8 space-y-3">
        {result?.error && <div className="panel p-4 text-red-400 text-sm">❌ {result.error}</div>}
        {result?.text && (
          <div className="panel p-4">
            <div className="label flex items-center justify-between">
              <span>Transcription</span>
              <div className="flex gap-1">
                <button onClick={() => navigator.clipboard.writeText(result.text)}
                  className="btn-ghost text-xs flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                <button onClick={() => download(`transcript-${Date.now()}.txt`, result.text)}
                  className="btn-ghost text-xs flex items-center gap-1"><Download className="w-3 h-3" /> TXT</button>
                {result.segments && (
                  <>
                    <button onClick={() => download(`transcript-${Date.now()}.srt`, toSRT(result.segments))}
                      className="btn-ghost text-xs flex items-center gap-1"><Download className="w-3 h-3" /> SRT</button>
                    <button onClick={() => download(`transcript-${Date.now()}.vtt`, toVTT(result.segments))}
                      className="btn-ghost text-xs flex items-center gap-1"><Download className="w-3 h-3" /> VTT</button>
                  </>
                )}
                <button onClick={() => download(`transcript-${Date.now()}.json`, JSON.stringify(result, null, 2), 'application/json')}
                  className="btn-ghost text-xs flex items-center gap-1"><Download className="w-3 h-3" /> JSON</button>
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap">{result.text}</div>
          </div>
        )}
        {result?.segments && (
          <div className="panel p-4 max-h-96 overflow-y-auto">
            <div className="label">Segments ({result.segments.length})</div>
            <div className="space-y-1 text-xs font-mono">
              {result.segments.map((s: any, i: number) => (
                <div key={i} className="flex gap-2">
                  <span className="text-groq-orange">[{s.start.toFixed(1)}s → {s.end.toFixed(1)}s]</span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {result?.duration_ms && (
          <div className="text-xs text-gray-500 dark:text-groq-muted">Latency: {result.duration_ms}ms · Detected language: {result.language || 'n/a'}</div>
        )}
      </section>
    </div>
  );
}
