'use client';

import { useState } from 'react';
import { Volume2, Loader2, Download } from 'lucide-react';
import { GROQ_MODELS, TTS_VOICES } from '@/lib/groq-models';

const PRESETS = [
  { label: 'Greeting', text: 'Hello! Welcome to Groq Studio. How can I help you today?' },
  { label: 'News read', text: 'Breaking news: scientists have made a remarkable discovery in quantum computing.' },
  { label: 'Story', text: 'Once upon a time, in a land far away, there lived a curious little fox who loved to explore the forest.' },
  { label: 'Numbers', text: 'The temperature today is 72 degrees Fahrenheit, with humidity at 45 percent.' },
  { label: 'Whisper', text: 'Shhh... can you keep a secret? Listen closely to what I am about to tell you.' },
];

export default function TTSModule() {
  const [model, setModel] = useState(GROQ_MODELS.audio.tts[0]);
  const [voice, setVoice] = useState(TTS_VOICES[0]);
  const [input, setInput] = useState('Hello! This is a demo of Groq Text-to-Speech.');
  const [format, setFormat] = useState('wav');
  const [speed, setSpeed] = useState(1);
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setLoading(true); setError(''); setAudioUrl('');
    try {
      const res = await fetch('/api/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, voice, input, response_format: format, speed }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error);
      }
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <aside className="col-span-4 panel p-4 space-y-4">
        <div>
          <div className="label">Model</div>
          <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
            {GROQ_MODELS.audio.tts.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <div className="label">Voice</div>
          <select className="input" value={voice} onChange={(e) => setVoice(e.target.value)}>
            {TTS_VOICES.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <div className="label">Format</div>
          <select className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="wav">wav</option>
            <option value="mp3">mp3</option>
            <option value="flac">flac</option>
            <option value="ogg">ogg</option>
            <option value="mulaw">mulaw</option>
          </select>
        </div>
        <div>
          <div className="label">Speed: {speed}x</div>
          <input type="range" min={0.25} max={4} step={0.25} value={speed}
            onChange={(e) => setSpeed(+e.target.value)} className="w-full accent-groq-orange" />
        </div>
        <button onClick={run} disabled={loading || !input.trim()} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
          Generate
        </button>
      </aside>

      <section className="col-span-8 space-y-4">
        <div className="panel p-4">
          <div className="label flex items-center justify-between">
            <span>Text Input</span>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => setInput(p.text)}
                  className="btn-ghost text-[10px] px-2 py-1">{p.label}</button>
              ))}
            </div>
          </div>
          <textarea aria-label="Text input" className="input min-h-[200px]" value={input}
            onChange={(e) => setInput(e.target.value)} maxLength={10000} />
          <div className={`text-xs mt-1 ${input.length > 9000 ? 'text-red-400' : input.length > 7000 ? 'text-yellow-400' : 'text-gray-500 dark:text-groq-muted'}`}>
            {input.length} / 10000 chars
          </div>
        </div>
        {error && <div className="panel p-4 text-red-400 text-sm">❌ {error}</div>}
        {audioUrl && (
          <div className="panel p-4 space-y-3">
            <audio controls src={audioUrl} className="w-full" />
            <a href={audioUrl} download={`speech.${format}`} className="btn-secondary inline-flex items-center gap-2">
              <Download className="w-4 h-4" /> Download
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
