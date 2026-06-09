'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Settings as SettingsIcon, Save, KeyRound, AlertCircle, Check, X, Loader2, Trash2,
  Mic, MicOff, Volume2, Play, Square,
} from 'lucide-react';
import { MODEL_PRICING } from '@/lib/pricing';

type Prefs = {
  defaultModel: string;
  defaultTemperature: number;
  streamingDefault: boolean;
  saveSessions: boolean;
};

const DEFAULT_PREFS: Prefs = {
  defaultModel: 'llama-3.3-70b-versatile',
  defaultTemperature: 0.7,
  streamingDefault: true,
  saveSessions: true,
};

export default function SettingsModule() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [savedMsg, setSavedMsg] = useState('');

  // API key state
  const [apiKey, setApiKey] = useState('');
  const [keyStatus, setKeyStatus] = useState<{ hasKey: boolean; masked: string | null; source: string }>({
    hasKey: false, masked: null, source: 'none',
  });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; sample?: string[] } | null>(null);
  const [savingKey, setSavingKey] = useState(false);

  // Microphone test state
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micVolume, setMicVolume] = useState(100);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string>('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('groq-studio-prefs');
      if (stored) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
    } catch {}
    refreshKeyStatus();
    checkMicPermission();
    return () => {
      stopMicTest();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkMicPermission() {
    try {
      const perm = await (navigator.permissions as any).query({ name: 'microphone' as PermissionName });
      setMicPermission(perm.state as any);
      perm.onchange = () => setMicPermission(perm.state as any);
    } catch {
      setMicPermission('unknown');
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === 'audioinput');
      setMicDevices(mics);
      if (mics.length > 0 && !selectedMicId) setSelectedMicId(mics[0].deviceId);
    } catch {}
  }

  async function requestMicPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicPermission('granted');
      // Re-enumerate to get device labels (only available after permission)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === 'audioinput');
      setMicDevices(mics);
      if (mics.length > 0 && !selectedMicId) setSelectedMicId(mics[0].deviceId);
    } catch (e: any) {
      setMicPermission('denied');
      alert('Permissão negada: ' + e.message);
    }
  }

  async function startMicTest() {
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;

      const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setMicLevel(Math.min(1, rms * (micVolume / 100) * 3));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setMicTesting(true);
    } catch (e: any) {
      alert('Erro ao iniciar teste: ' + e.message);
    }
  }

  function stopMicTest() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setMicLevel(0);
    setMicTesting(false);
    if (recording) stopRecordingTest();
  }

  async function startRecordingTest() {
    if (!micStreamRef.current) {
      await startMicTest();
    }
    if (!micStreamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(micStreamRef.current, { mimeType: 'audio/webm' });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setRecordedBlob(blob);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(URL.createObjectURL(blob));
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    setTranscript('');
  }

  function stopRecordingTest() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  }

  async function transcribeRecording() {
    if (!recordedBlob) return;
    setTranscribing(true);
    setTranscript('');
    try {
      const form = new FormData();
      form.append('file', recordedBlob, 'test.webm');
      form.append('model', 'whisper-large-v3-turbo');
      form.append('response_format', 'json');
      const res = await fetch('/api/audio/transcribe', { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTranscript(data.text || '(sem texto detectado)');
    } catch (e: any) {
      setTranscript('Erro: ' + e.message);
    } finally {
      setTranscribing(false);
    }
  }

  async function refreshKeyStatus() {
    try {
      const r = await fetch('/api/settings/api-key');
      if (r.ok) setKeyStatus(await r.json());
    } catch {}
  }

  function savePrefs() {
    localStorage.setItem('groq-studio-prefs', JSON.stringify(prefs));
    setSavedMsg('Preferências salvas');
    setTimeout(() => setSavedMsg(''), 2000);
  }

  async function testKey() {
    if (!apiKey.trim()) {
      setTestResult({ ok: false, msg: 'Informe uma chave para testar' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch('/api/settings/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const j = await r.json();
      if (j.ok) {
        setTestResult({ ok: true, msg: `Conectado · ${j.models_count} modelos disponíveis`, sample: j.sample });
      } else {
        setTestResult({ ok: false, msg: j.error || `Falha (${j.status || r.status})` });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message });
    } finally {
      setTesting(false);
    }
  }

  async function saveKey() {
    if (!apiKey.trim()) return;
    setSavingKey(true);
    try {
      const r = await fetch('/api/settings/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const j = await r.json();
      if (j.ok) {
        setApiKey('');
        setTestResult({ ok: true, msg: 'Chave salva no servidor (cookie HttpOnly)' });
        await refreshKeyStatus();
      } else {
        setTestResult({ ok: false, msg: j.error || 'Falha ao salvar' });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message });
    } finally {
      setSavingKey(false);
    }
  }

  async function clearKey() {
    if (!confirm('Remover a chave API armazenada?')) return;
    await fetch('/api/settings/api-key', { method: 'DELETE' });
    setTestResult(null);
    await refreshKeyStatus();
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <aside className="col-span-12 md:col-span-3 panel p-4 h-fit">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <SettingsIcon className="w-4 h-4" /> Settings
        </h2>
        <p className="text-xs text-gray-500 dark:text-groq-muted mt-2">
          Preferências da interface ficam no navegador. A chave da API pode ser configurada aqui (cookie
          HttpOnly) ou em <code className="text-groq-orange">.env.local</code> no servidor.
        </p>
      </aside>

      <section className="col-span-12 md:col-span-9 space-y-4">
        {/* Defaults */}
        <div className="panel p-4 space-y-3">
          <h3 className="font-medium">Defaults</h3>
          <div>
            <div className="label">Default model</div>
            <select aria-label="Default model" className="input"
              value={prefs.defaultModel}
              onChange={(e) => setPrefs({ ...prefs, defaultModel: e.target.value })}>
              {Object.keys(MODEL_PRICING).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div className="label">Default temperature: {prefs.defaultTemperature}</div>
            <input aria-label="Default temperature" type="range" min={0} max={2} step={0.1}
              value={prefs.defaultTemperature}
              onChange={(e) => setPrefs({ ...prefs, defaultTemperature: parseFloat(e.target.value) })}
              className="w-full" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={prefs.streamingDefault}
              onChange={(e) => setPrefs({ ...prefs, streamingDefault: e.target.checked })} />
            Enable streaming by default
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={prefs.saveSessions}
              onChange={(e) => setPrefs({ ...prefs, saveSessions: e.target.checked })} />
            Save chat sessions to PostgreSQL
          </label>
          <button onClick={savePrefs} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" /> Save preferences
          </button>
          {savedMsg && <div className="text-xs text-green-400">{savedMsg}</div>}
        </div>

        {/* Microphone Test */}
        <div className="panel p-4 space-y-3">
          <h3 className="font-medium flex items-center gap-2">
            <Mic className="w-4 h-4" /> Teste de Microfone
          </h3>
          <p className="text-xs text-gray-500 dark:text-groq-muted">
            Verifique se o microfone está funcionando antes de usar o Neural Voice AI.
          </p>

          {/* Permission status */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 dark:text-groq-muted">Permissão:</span>
            {micPermission === 'granted' && (
              <span className="text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Concedida</span>
            )}
            {micPermission === 'denied' && (
              <span className="text-red-400 flex items-center gap-1"><X className="w-3 h-3" /> Negada</span>
            )}
            {(micPermission === 'prompt' || micPermission === 'unknown') && (
              <button onClick={requestMicPermission} className="btn-primary text-xs px-2 py-1">
                Solicitar permissão
              </button>
            )}
          </div>

          {/* Device selection */}
          <div>
            <div className="label">Microfone</div>
            <select
              aria-label="Microphone device"
              className="input"
              value={selectedMicId}
              onChange={(e) => {
                setSelectedMicId(e.target.value);
                if (micTesting) {
                  stopMicTest();
                  setTimeout(() => startMicTest(), 100);
                }
              }}
              disabled={micDevices.length === 0}
            >
              {micDevices.length === 0 && <option>Nenhum microfone detectado</option>}
              {micDevices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microfone ${i + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Volume slider */}
          <div>
            <div className="label">Sensibilidade: {micVolume}%</div>
            <input
              aria-label="Mic sensitivity"
              type="range"
              min={10}
              max={200}
              step={5}
              value={micVolume}
              onChange={(e) => setMicVolume(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Level meter */}
          <div>
            <div className="label flex items-center gap-1"><Volume2 className="w-3 h-3" /> Nível do microfone</div>
            <div className="h-4 bg-gray-200 dark:bg-groq-dark rounded overflow-hidden flex">
              {Array.from({ length: 30 }).map((_, i) => {
                const threshold = (i + 1) / 30;
                const active = micLevel >= threshold;
                let color = 'bg-green-500';
                if (threshold > 0.7) color = 'bg-red-500';
                else if (threshold > 0.45) color = 'bg-yellow-500';
                return (
                  <div
                    key={i}
                    className={`flex-1 mx-px transition-opacity ${active ? color : 'opacity-20 bg-gray-400'}`}
                  />
                );
              })}
            </div>
            <p className="text-[10px] text-gray-500 dark:text-groq-muted mt-1">
              {micTesting ? 'Fale algo — as barras devem se mover.' : 'Clique em "Iniciar teste" e fale.'}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {!micTesting ? (
              <button onClick={startMicTest} className="btn-primary flex items-center gap-2 text-sm">
                <Play className="w-4 h-4" /> Iniciar teste
              </button>
            ) : (
              <button onClick={stopMicTest} className="btn-ghost flex items-center gap-2 text-sm">
                <Square className="w-4 h-4" /> Parar
              </button>
            )}

            {micTesting && !recording && (
              <button onClick={startRecordingTest} className="btn flex items-center gap-2 text-sm bg-red-600 text-white hover:bg-red-700">
                <Mic className="w-4 h-4" /> Gravar amostra
              </button>
            )}
            {recording && (
              <button onClick={stopRecordingTest} className="btn flex items-center gap-2 text-sm bg-red-600 text-white hover:bg-red-700 animate-pulse">
                <Square className="w-4 h-4" /> Parar gravação
              </button>
            )}
          </div>

          {/* Recorded sample playback + transcription */}
          {recordedUrl && (
            <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-groq-border">
              <div className="label">Amostra gravada</div>
              <audio src={recordedUrl} controls className="w-full" />
              <button
                onClick={transcribeRecording}
                disabled={transcribing}
                className="btn-ghost flex items-center gap-2 text-xs disabled:opacity-50"
              >
                {transcribing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Testar com Whisper (transcrever)
              </button>
              {transcript && (
                <div className="text-xs p-2 rounded bg-gray-100 dark:bg-groq-dark border border-gray-200 dark:border-groq-border">
                  <strong>Transcrição:</strong> {transcript}
                </div>
              )}
            </div>
          )}
        </div>

        {/* API Key */}
        <div className="panel p-4 space-y-3">
          <h3 className="font-medium flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Groq API Key
          </h3>

          {/* Status */}
          <div className="text-xs flex items-center gap-2">
            {keyStatus.source === 'cookie' && (
              <span className="badge border-green-500/50 text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> Cookie configurado · {keyStatus.masked}
              </span>
            )}
            {keyStatus.source === 'env' && (
              <span className="badge border-blue-500/50 text-blue-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> Usando GROQ_API_KEY do .env.local
              </span>
            )}
            {keyStatus.source === 'none' && (
              <span className="badge border-yellow-500/50 text-yellow-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Nenhuma chave configurada
              </span>
            )}
          </div>

          <div>
            <div className="label">API Key</div>
            <div className="flex gap-2">
              <input
                aria-label="API Key"
                type={showKey ? 'text' : 'password'}
                placeholder="gsk_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="input flex-1 font-mono text-xs"
                autoComplete="off"
              />
              <button onClick={() => setShowKey((s) => !s)} className="btn-ghost text-xs">
                {showKey ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-groq-muted mt-1">
              A chave fica em cookie HttpOnly no servidor (não acessível via JS do navegador).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={testKey} disabled={testing || !apiKey.trim()}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Test connection
            </button>
            <button onClick={saveKey} disabled={savingKey || !apiKey.trim()}
              className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
            {keyStatus.hasKey && (
              <button onClick={clearKey} className="btn-ghost text-red-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Clear stored key
              </button>
            )}
          </div>

          {testResult && (
            <div className={`text-xs flex items-start gap-2 p-2 rounded border
              ${testResult.ok
                ? 'border-green-500/40 bg-green-500/5 text-green-400'
                : 'border-red-500/40 bg-red-500/5 text-red-400'}`}>
              {testResult.ok ? <Check className="w-3 h-3 mt-0.5 shrink-0" /> : <X className="w-3 h-3 mt-0.5 shrink-0" />}
              <div>
                <div>{testResult.msg}</div>
                {testResult.sample && testResult.sample.length > 0 && (
                  <div className="text-[10px] text-gray-500 dark:text-groq-muted mt-1">
                    Ex: {testResult.sample.join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* API Configuration docs */}
        <div className="panel p-4 space-y-2">
          <h3 className="font-medium">API Configuration</h3>
          <p className="text-xs text-gray-500 dark:text-groq-muted flex items-start gap-2">
            <AlertCircle className="w-3 h-3 mt-0.5 text-groq-orange" />
            Configurações sensíveis (chave Groq, conexão Postgres, auth) podem vir do
            <code className="mx-1 text-groq-orange">.env.local</code> no servidor ou da UI acima.
          </p>
          <pre className="text-[11px] font-mono bg-gray-200 dark:bg-groq-dark border border-gray-200 dark:border-groq-border rounded p-3 overflow-x-auto">
{`# Required (or set via Settings UI)
GROQ_API_KEY=gsk_...
# Database
DATABASE_URL=postgresql://...
# Optional security
APP_AUTH_TOKEN=<bearer-token>
RATE_LIMIT_PER_MIN=60`}
          </pre>
        </div>

        {/* Pricing */}
        <div className="panel p-4">
          <h3 className="font-medium mb-1">Model Pricing Reference</h3>
          <p className="text-xs text-gray-500 dark:text-groq-muted mb-3">USD por 1M tokens (input/output). Aproximado.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {Object.entries(MODEL_PRICING).map(([model, p]: [string, any]) => (
              <div key={model} className="flex items-center justify-between gap-2 border border-gray-200 dark:border-groq-border rounded px-2 py-1.5">
                <span className="font-mono truncate" title={model}>{model}</span>
                <span className="text-gray-500 dark:text-groq-muted shrink-0">
                  {typeof p.input === 'number' ? `$${p.input}/$${p.output}` : `${p.input}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
