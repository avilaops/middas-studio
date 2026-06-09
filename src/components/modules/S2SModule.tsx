'use client';

import { useRef, useState } from 'react';
import { Mic, MicOff, Loader2, Volume2, Trash2 } from 'lucide-react';
import { GROQ_MODELS, TTS_VOICES } from '@/lib/groq-models';
import { useGroqModels, isChatLikeModel } from '@/lib/use-groq-models';

export default function S2SModule() {
  const availableModels = useGroqModels(isChatLikeModel, GROQ_MODELS.chat);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [system, setSystem] = useState('You are a concise voice assistant. Keep replies short.');
  const [llmModel, setLlmModel] = useState(GROQ_MODELS.chat[0]);
  const [voice, setVoice] = useState(TTS_VOICES[0]);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await process(blob);
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

  async function process(blob: Blob) {
    setLoading(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'voice.webm');
      fd.append('llm_model', llmModel);
      fd.append('voice', voice);
      fd.append('system', system);
      const res = await fetch('/api/s2s', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.audio_base64) {
        const audio = new Audio(`data:audio/wav;base64,${json.audio_base64}`);
        audio.play();
      }
      setResult(json);
      if (json.user_text) {
        setHistory((h) => [{ ...json, ts: Date.now() }, ...h].slice(0, 20));
      }
    } catch (e: any) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <aside className="col-span-4 panel p-4 space-y-4">
        <div className="text-sm text-gray-500 dark:text-groq-muted">
          Pipeline: STT (whisper) → LLM → TTS (PlayAI). Grave do microfone e ouça a resposta.
        </div>
        <div>
          <div className="label">LLM Model</div>
          <select aria-label="LLM model" className="input" value={llmModel} onChange={(e) => setLlmModel(e.target.value)}>
            {availableModels.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <div className="label">Voice</div>
          <select aria-label="Voice" className="input" value={voice} onChange={(e) => setVoice(e.target.value)}>
            {TTS_VOICES.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <div className="label">System prompt</div>
          <textarea aria-label="System prompt" className="input min-h-[80px]"
            value={system} onChange={(e) => setSystem(e.target.value)} />
        </div>

        {!recording ? (
          <button onClick={startRec} disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2">
            <Mic className="w-4 h-4" /> Start recording
          </button>
        ) : (
          <button onClick={stopRec}
            className="btn w-full bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-2">
            <MicOff className="w-4 h-4" /> Stop & send
          </button>
        )}
      </aside>

      <section className="col-span-8 space-y-3">
        {loading && (
          <div className="panel p-6 flex items-center gap-3 text-gray-500 dark:text-groq-muted">
            <Loader2 className="w-5 h-5 animate-spin" /> Processing pipeline...
          </div>
        )}
        {result?.error && <div className="panel p-4 text-red-400 text-sm">❌ {result.error}</div>}
        {result?.user_text && (
          <>
            <div className="panel p-4">
              <div className="label">You said</div>
              <div className="text-sm">{result.user_text}</div>
            </div>
            <div className="panel p-4">
              <div className="label flex items-center gap-2"><Volume2 className="w-3 h-3" /> Reply</div>
              <div className="text-sm">{result.reply_text}</div>
              {result.audio_base64 && (
                <audio controls src={`data:audio/wav;base64,${result.audio_base64}`} className="w-full mt-3" />
              )}
            </div>
            {result.timings && (
              <div className="panel p-4 grid grid-cols-4 gap-3 text-center">
                <div><div className="text-xs text-gray-500 dark:text-groq-muted">STT</div><div className="font-mono">{result.timings.stt_ms}ms</div></div>
                <div><div className="text-xs text-gray-500 dark:text-groq-muted">LLM</div><div className="font-mono">{result.timings.llm_ms}ms</div></div>
                <div><div className="text-xs text-gray-500 dark:text-groq-muted">TTS</div><div className="font-mono">{result.timings.tts_ms}ms</div></div>
                <div><div className="text-xs text-gray-500 dark:text-groq-muted">Total</div><div className="font-mono text-groq-orange">{result.timings.total_ms}ms</div></div>
              </div>
            )}
          </>
        )}
        {history.length > 0 && (
          <div className="panel p-4">
            <div className="label flex items-center justify-between">
              <span>History ({history.length})</span>
              <button onClick={() => setHistory([])} className="btn-ghost text-xs flex items-center gap-1 text-red-400">
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            </div>
            <div className="space-y-2 mt-2 max-h-64 overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="text-xs border-b border-gray-200 dark:border-groq-border/30 pb-2">
                  <div className="text-gray-500 dark:text-groq-muted">{new Date(h.ts).toLocaleTimeString()}</div>
                  <div><span className="text-blue-400">You:</span> {h.user_text}</div>
                  <div><span className="text-groq-orange">AI:</span> {h.reply_text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
