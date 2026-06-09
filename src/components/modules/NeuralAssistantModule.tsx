'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Trash2,
  Brain,
  Loader2,
  User,
  Bot,
  Zap,
  ZapOff,
  Send,
  History,
} from 'lucide-react';
import { GROQ_MODELS, TTS_VOICES } from '@/lib/groq-models';
import { useGroqModels, isChatLikeModel } from '@/lib/use-groq-models';
import NeuralNetwork, { type NeuralState } from '@/components/NeuralNetwork';

type TTSProvider = 'cloud' | 'local';

type Message = {
  role: 'user' | 'assistant';
  text: string;
  audioUrls?: string[];
  timestamp: number;
};

// VAD/barge-in thresholds (RMS 0..1)
const VAD_SPEECH_THRESHOLD = 0.04;
const VAD_SILENCE_THRESHOLD = 0.02;
const VAD_SILENCE_MS = 900; // how long of silence before auto-stop
const BARGE_IN_THRESHOLD = 0.1;
const BARGE_IN_MS = 350; // sustained voice while assistant speaking → interrupt
const MIN_FIRST_CHUNK = 12; // first chunk small for fast time-to-first-audio
const MIN_CHUNK = 40; // later chunks larger to keep Piper efficient

function splitSentences(
  buffer: string,
  isFirst: boolean
): { sentences: string[]; rest: string } {
  // Captures up to a sentence terminator. Different min length for first vs later chunks.
  const out: string[] = [];
  let last = 0;
  const re = /([.!?]+[\s)"']*|[,;:][\s]|\n+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buffer)) !== null) {
    const end = m.index + m[0].length;
    const piece = buffer.slice(last, end).trim();
    const minLen = isFirst && out.length === 0 ? MIN_FIRST_CHUNK : MIN_CHUNK;
    // Strong terminators (.!?\n) always flush if min length met; weak (,;:) only on later chunks above MIN_CHUNK
    const strong = /[.!?\n]/.test(m[0]);
    if (piece.length >= minLen && (strong || piece.length >= MIN_CHUNK * 1.5)) {
      out.push(piece);
      last = end;
    }
  }
  return { sentences: out, rest: buffer.slice(last) };
}

export default function NeuralAssistantModule() {
  const availableModels = useGroqModels(isChatLikeModel, GROQ_MODELS.chat);

  // Configuration
  const [llmModel, setLlmModel] = useState(GROQ_MODELS.chat[0]);
  const [voice, setVoice] = useState('Arista-PlayAI');
  const [system, setSystem] = useState(
    'You are a helpful AI assistant. Keep your responses clear and concise for voice interaction. Reply in the same language the user spoke.'
  );
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [streamMode, setStreamMode] = useState(true);
  const [bargeIn, setBargeIn] = useState(true);
  const [autoVAD, setAutoVAD] = useState(true);
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>('cloud');
  const [localVoices, setLocalVoices] = useState<string[]>([]);
  const [localVoice, setLocalVoice] = useState<string>('en_GB-alan-medium');
  const [continuousMode, setContinuousMode] = useState(false);
  const [wakeWord, setWakeWord] = useState('jarvis');

  // Mirror config in refs so async callbacks see latest values
  const cfgRef = useRef({ ttsProvider, voice, localVoice, bargeIn, continuousMode, wakeWord });
  cfgRef.current = { ttsProvider, voice, localVoice, bargeIn, continuousMode, wakeWord };

  useEffect(() => {
    fetch('/api/audio/speech-local')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.voices) && d.voices.length) {
          setLocalVoices(d.voices);
          if (!d.voices.includes(localVoice)) setLocalVoice(d.voices[0]);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [statusText, setStatusText] = useState('Ready to listen');
  const [amplitude, setAmplitude] = useState(0);
  const [streamingText, setStreamingText] = useState('');
  const [textInput, setTextInput] = useState('');

  // Refs
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const continuousRecorderRef = useRef<MediaRecorder | null>(null);
  const continuousChunksRef = useRef<Blob[]>([]);
  const continuousIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const playAnalyserRef = useRef<AnalyserNode | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const ampRafRef = useRef<number | null>(null);
  const vadStateRef = useRef({ hadSpeech: false, silenceStart: 0, bargeStart: 0 });
  const queueRef = useRef<{ url: string }[]>([]);
  const playingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const accUrlsRef = useRef<string[]>([]);
  const inflightTtsRef = useRef<Promise<void>>(Promise.resolve());

  function ensureAudioCtx() {
    if (!audioCtxRef.current) {
      const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    const ctx = audioCtxRef.current!;
    if (ctx.state === 'suspended') {
      ctx.resume().catch((e) => console.warn('AudioContext resume failed', e));
    }
    return ctx;
  }

  /* ---------------- Amplitude / VAD / Barge-in loop ---------------- */

  const ampDataRef = useRef<Uint8Array>(new Uint8Array(2048));
  const micDataRef = useRef<Uint8Array>(new Uint8Array(2048));

  function startAmpLoop() {
    if (ampRafRef.current) return;
    const tick = () => {
      let rms = 0;
      const data = ampDataRef.current;
      // pick whichever analyser is most relevant for visualization
      const an = recording
        ? micAnalyserRef.current
        : speaking
          ? playAnalyserRef.current
          : micAnalyserRef.current;
      if (an) {
        const len = Math.min(data.length, an.frequencyBinCount);
        an.getByteTimeDomainData(data.subarray(0, len) as any);
        let sum = 0;
        for (let i = 0; i < len; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        rms = Math.sqrt(sum / len);
      }
      const display = Math.min(1, rms * 2.5);
      setAmplitude(display);

      // VAD auto-stop (only while recording)
      if (recording && autoVAD) {
        const v = vadStateRef.current;
        if (rms > VAD_SPEECH_THRESHOLD) {
          v.hadSpeech = true;
          v.silenceStart = 0;
        } else if (v.hadSpeech && rms < VAD_SILENCE_THRESHOLD) {
          if (!v.silenceStart) v.silenceStart = performance.now();
          else if (performance.now() - v.silenceStart > VAD_SILENCE_MS) {
            stopRecording();
          }
        }
      }

      // Barge-in (only while assistant speaking AND mic is open)
      if (speaking && cfgRef.current.bargeIn && micAnalyserRef.current) {
        const micData = micDataRef.current;
        const mlen = Math.min(micData.length, micAnalyserRef.current.frequencyBinCount);
        micAnalyserRef.current.getByteTimeDomainData(micData.subarray(0, mlen) as any);
        let s = 0;
        for (let i = 0; i < mlen; i++) {
          const v = (micData[i] - 128) / 128;
          s += v * v;
        }
        const micRms = Math.sqrt(s / mlen);
        const v = vadStateRef.current;
        if (micRms > BARGE_IN_THRESHOLD) {
          if (!v.bargeStart) v.bargeStart = performance.now();
          else if (performance.now() - v.bargeStart > BARGE_IN_MS) {
            v.bargeStart = 0;
            interruptAndListen();
          }
        } else {
          v.bargeStart = 0;
        }
      }

      ampRafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopAmpLoop() {
    if (ampRafRef.current) cancelAnimationFrame(ampRafRef.current);
    ampRafRef.current = null;
    setAmplitude(0);
  }

  async function openMic() {
    if (recStreamRef.current) return recStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recStreamRef.current = stream;
    const ctx = ensureAudioCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    micAnalyserRef.current = analyser;
    return stream;
  }

  function closeMic() {
    recStreamRef.current?.getTracks().forEach((t) => t.stop());
    recStreamRef.current = null;
    micAnalyserRef.current = null;
  }

  /* ---------------- Recording ---------------- */

  async function startRecording() {
    try {
      const stream = await openMic();
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        // keep mic open for barge-in next round
        await processVoiceInput(audioBlob);
      };
      recorder.start();
      recorderRef.current = recorder;
      vadStateRef.current = { hadSpeech: false, silenceStart: 0, bargeStart: 0 };
      setRecording(true);
      setStatusText(autoVAD ? 'Listening (auto-stop on silence)…' : 'Listening…');
      startAmpLoop();
    } catch (e: any) {
      setStatusText('Microphone access denied');
      alert('Failed to access microphone: ' + e.message);
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
    setStatusText('Processing…');
  }

  /* ---------------- TTS queue ---------------- */

  function ttsEndpointAndBody(text: string) {
    const { ttsProvider, voice, localVoice } = cfgRef.current;
    if (ttsProvider === 'local') {
      return {
        url: '/api/audio/speech-local',
        body: { input: text, voice: localVoice },
      };
    }
    return {
      url: '/api/audio/speech',
      body: { model: 'playai-tts', voice, input: text, response_format: 'wav', speed: 1 },
    };
  }

  async function synthesize(text: string, signal?: AbortSignal): Promise<string | null> {
    try {
      const { url, body } = ttsEndpointAndBody(text);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }

  async function enqueueAndPlay(text: string, signal?: AbortSignal) {
    // Synthesize in background; preserve order via chain
    const prev = inflightTtsRef.current;
    inflightTtsRef.current = (async () => {
      await prev.catch(() => {});
      if (signal?.aborted) return;
      const url = await synthesize(text, signal);
      if (!url || signal?.aborted) return;
      queueRef.current.push({ url });
      accUrlsRef.current.push(url);
      if (!playingRef.current) playNext();
    })();
  }

  function playNext() {
    const item = queueRef.current.shift();
    if (!item) {
      playingRef.current = false;
      setSpeaking(false);
      currentAudioRef.current = null;
      playAnalyserRef.current = null;
      setStatusText('Ready to listen');
      return;
    }
    playingRef.current = true;
    setSpeaking(true);

    const ctx = ensureAudioCtx();
    const audio = new Audio(item.url);
    currentAudioRef.current = audio;
    try {
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      playAnalyserRef.current = analyser;
    } catch {
      // already wired (shouldn't happen with new Audio), fall back
    }
    audio.onended = () => playNext();
    audio.onerror = (e) => {
      console.error('audio.onerror', e, audio.error);
      playNext();
    };
    audio.play().catch((err) => {
      console.error('audio.play() rejected', err);
      playNext();
    });
  }

  function clearQueue() {
    queueRef.current = [];
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    playingRef.current = false;
    setSpeaking(false);
    playAnalyserRef.current = null;
  }

  function stopSpeaking() {
    abortRef.current?.abort();
    clearQueue();
    setStatusText('Ready to listen');
  }

  async function interruptAndListen() {
    stopSpeaking();
    // brief pause to avoid catching the tail of our own voice
    await new Promise((r) => setTimeout(r, 120));
    if (!recording) startRecording();
  }

  /* ---------------- Continuous listening mode ---------------- */

  async function startContinuousListening() {
    try {
      const stream = await openMic();
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      continuousRecorderRef.current = recorder;
      continuousChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) continuousChunksRef.current.push(e.data);
      };

      // Process chunks every 3 seconds
      const interval = setInterval(async () => {
        if (continuousChunksRef.current.length > 0 && !processing) {
          const audioBlob = new Blob(continuousChunksRef.current, { type: 'audio/webm' });
          continuousChunksRef.current = [];
          await processContinuousChunk(audioBlob);
        }
      }, 3000);

      continuousIntervalRef.current = interval;
      recorder.start(500); // Capture in 500ms slices
      setStatusText(`Listening for "${cfgRef.current.wakeWord}"...`);
      startAmpLoop();
    } catch (e: any) {
      setStatusText('Microphone access denied');
      alert('Failed to access microphone: ' + e.message);
      setContinuousMode(false);
    }
  }

  function stopContinuousListening() {
    if (continuousRecorderRef.current && continuousRecorderRef.current.state !== 'inactive') {
      continuousRecorderRef.current.stop();
    }
    if (continuousIntervalRef.current) {
      clearInterval(continuousIntervalRef.current);
      continuousIntervalRef.current = null;
    }
    continuousRecorderRef.current = null;
    closeMic();
    setStatusText('Continuous mode stopped');
  }

  async function processContinuousChunk(audioBlob: Blob) {
    try {
      const form = new FormData();
      form.append('file', audioBlob, 'voice.webm');
      form.append('model', 'whisper-large-v3-turbo');
      form.append('response_format', 'json');
      const res = await fetch('/api/audio/transcribe', { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) return;
      const text = data.text?.trim().toLowerCase();
      if (!text) return;

      const { wakeWord } = cfgRef.current;
      if (text.includes(wakeWord.toLowerCase())) {
        // Wake word detected! Extract command after wake word
        const commandText = text.replace(wakeWord.toLowerCase(), '').trim();
        if (commandText.length > 3) {
          setStatusText('Wake word detected! Processing...');
          await runConversation(commandText, new AbortController());
        }
      }
    } catch (e) {
      console.error('Continuous chunk error:', e);
    }
  }

  function saveConversationLog() {
    if (messages.length === 0) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logData = {
      timestamp: new Date().toISOString(),
      messages: messages.map(m => ({
        role: m.role,
        text: m.text,
        timestamp: new Date(m.timestamp).toISOString(),
      })),
    };
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-conversation-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Effect to toggle continuous mode
  useEffect(() => {
    if (continuousMode) {
      startContinuousListening();
    } else {
      stopContinuousListening();
    }
    return () => {
      stopContinuousListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continuousMode]);

  /* ---------------- Main pipeline ---------------- */

  async function processVoiceInput(audioBlob: Blob) {
    setProcessing(true);
    setStreamingText('');
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      setStatusText('Transcribing…');
      const form = new FormData();
      form.append('file', audioBlob, 'voice.webm');
      form.append('model', 'whisper-large-v3-turbo');
      form.append('response_format', 'json');
      const tRes = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: form,
        signal: ac.signal,
      });
      const tData = await tRes.json();
      if (tData.error) throw new Error(tData.error);
      const userText = tData.text?.trim();
      if (!userText) {
        setStatusText('No speech detected');
        setProcessing(false);
        return;
      }
      await runConversation(userText, ac);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setStatusText('Error: ' + e.message);
        console.error(e);
      }
    } finally {
      setProcessing(false);
    }
  }

  async function processTextInput(userText: string) {
    if (!userText.trim()) return;
    setProcessing(true);
    setStreamingText('');
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await runConversation(userText.trim(), ac);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setStatusText('Error: ' + e.message);
        console.error(e);
      }
    } finally {
      setProcessing(false);
    }
  }

  async function runConversation(userText: string, ac: AbortController) {
    accUrlsRef.current = [];
    const userMsg: Message = { role: 'user', text: userText, timestamp: Date.now() };
    setMessages((p) => [...p, userMsg]);

    setStatusText('Thinking…');
    const chatHistory = [...messages, userMsg].map((m) => ({ role: m.role, content: m.text }));
    const chatBody = {
      model: llmModel,
      messages: [{ role: 'system', content: system }, ...chatHistory],
      temperature: 0.7,
      stream: streamMode,
    };

    let finalText = '';

    if (streamMode) {
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody),
        signal: ac.signal,
      });
      if (!chatRes.ok || !chatRes.body) throw new Error(`chat ${chatRes.status}`);

      const reader = chatRes.body.getReader();
      const decoder = new TextDecoder();
      let sseBuf = '';
      let sentenceBuf = '';

      setStatusText('Speaking…');
      let firstChunk = true;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuf += decoder.decode(value, { stream: true });
        const lines = sseBuf.split('\n');
        sseBuf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const obj = JSON.parse(data);
            if (obj.delta) {
              finalText += obj.delta;
              sentenceBuf += obj.delta;
              setStreamingText(finalText);
              if (autoSpeak) {
                const { sentences, rest } = splitSentences(sentenceBuf, firstChunk);
                if (sentences.length) firstChunk = false;
                sentenceBuf = rest;
                for (const s of sentences) enqueueAndPlay(s, ac.signal);
              }
            }
          } catch {
            /* ignore */
          }
        }
      }
      if (autoSpeak && sentenceBuf.trim().length > 0) {
        enqueueAndPlay(sentenceBuf.trim(), ac.signal);
      }
    } else {
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...chatBody, stream: false }),
        signal: ac.signal,
      });
      const chatData = await chatRes.json();
      if (chatData.error) throw new Error(chatData.error);
      finalText = chatData.choices[0].message.content;
      setStreamingText(finalText);
      if (autoSpeak) {
        setStatusText('Speaking…');
        const { sentences, rest } = splitSentences(finalText + '\n', true);
        for (const s of sentences) enqueueAndPlay(s, ac.signal);
        if (rest.trim()) enqueueAndPlay(rest.trim(), ac.signal);
      }
    }

    const assistantMsg: Message = {
      role: 'assistant',
      text: finalText,
      audioUrls: accUrlsRef.current.slice(),
      timestamp: Date.now(),
    };
    setMessages((p) => [...p, assistantMsg]);
    setStreamingText('');
  }

  function playMessage(urls: string[]) {
    stopSpeaking();
    queueRef.current = urls.map((url) => ({ url }));
    if (!playingRef.current) playNext();
  }

  function clearHistory() {
    setMessages([]);
    stopSpeaking();
    setStreamingText('');
    setStatusText('Ready to listen');
  }

  // Keep amp loop alive while interactive
  useEffect(() => {
    if (recording || speaking) startAmpLoop();
    else if (!recording && !speaking) {
      // keep running briefly to catch barge-in tails; just stop when idle
      stopAmpLoop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, speaking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAmpLoop();
      closeMic();
      abortRef.current?.abort();
      clearQueue();
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActive = recording || processing || speaking;
  const neuralState: NeuralState = speaking
    ? 'speaking'
    : processing
      ? 'thinking'
      : recording
        ? 'listening'
        : 'idle';

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
      <aside className="col-span-3 panel p-4 overflow-y-auto space-y-4">
        <div>
          <div className="label">LLM Model</div>
          <select className="input" value={llmModel} onChange={(e) => setLlmModel(e.target.value)}>
            {availableModels.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <div className="label">TTS Provider</div>
          <select
            className="input"
            value={ttsProvider}
            onChange={(e) => setTtsProvider(e.target.value as TTSProvider)}
          >
            <option value="cloud">Cloud (PlayAI / Groq)</option>
            <option value="local">Local (Piper, offline)</option>
          </select>
        </div>

        {ttsProvider === 'cloud' ? (
          <div>
            <div className="label">Voice (Cloud)</div>
            <select className="input" value={voice} onChange={(e) => setVoice(e.target.value)}>
              {TTS_VOICES.map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <div className="label">Voice (Local)</div>
            <select
              className="input"
              value={localVoice}
              onChange={(e) => setLocalVoice(e.target.value)}
            >
              {(localVoices.length ? localVoices : [localVoice]).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <div className="text-xs text-gray-500 dark:text-groq-muted mt-1">
              {localVoices.length} voz(es) em PIPER_VOICES_DIR
            </div>
          </div>
        )}

        <div>
          <div className="label">System Prompt</div>
          <textarea
            className="input min-h-[120px] text-xs"
            value={system}
            onChange={(e) => setSystem(e.target.value)}
          />
        </div>

        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-groq-border">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} className="accent-groq-orange" />
            Auto-speak responses
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={streamMode} onChange={(e) => setStreamMode(e.target.checked)} className="accent-groq-orange" />
            Streaming (low latency)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={autoVAD} onChange={(e) => setAutoVAD(e.target.checked)} className="accent-groq-orange" />
            Auto-stop on silence (VAD)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={bargeIn} onChange={(e) => setBargeIn(e.target.checked)} className="accent-groq-orange" />
            Barge-in (interrupt while speaking)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={continuousMode} onChange={(e) => setContinuousMode(e.target.checked)} className="accent-groq-orange" />
            Continuous listening (wake word)
          </label>
        </div>

        {continuousMode && (
          <div className="pt-2">
            <div className="label">Wake Word</div>
            <input
              type="text"
              className="input"
              value={wakeWord}
              onChange={(e) => setWakeWord(e.target.value)}
              placeholder="e.g., jarvis, hey assistant"
            />
            <p className="text-xs text-gray-500 dark:text-groq-muted mt-1">
              Say this word to activate the assistant in continuous mode
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-gray-200 dark:border-groq-border space-y-2">
          <button
            onClick={clearHistory}
            disabled={messages.length === 0}
            className="btn-ghost w-full flex items-center justify-center gap-2 text-xs"
          >
            <Trash2 className="w-3 h-3" />
            Clear History
          </button>
          <button
            onClick={saveConversationLog}
            disabled={messages.length === 0}
            className="btn-ghost w-full flex items-center justify-center gap-2 text-xs"
          >
            <History className="w-3 h-3" />
            Save Conversation Log
          </button>
        </div>

        <div className="text-xs text-gray-500 dark:text-groq-muted space-y-1 pt-3 border-t border-gray-200 dark:border-groq-border">
          <div className="font-semibold text-gray-700 dark:text-white">Pipeline:</div>
          <div className="flex items-center gap-1">{streamMode ? <Zap className="w-3 h-3" /> : <ZapOff className="w-3 h-3" />} {streamMode ? 'Streaming' : 'Batch'}</div>
          <div>1. 🎤 Whisper</div>
          <div>2. 🧠 {llmModel}</div>
          <div>3. 🔊 {ttsProvider === 'local' ? `Piper · ${localVoice}` : `PlayAI · ${voice}`}</div>
        </div>
      </aside>

      <section className="col-span-9 flex flex-col">
        <div className="panel relative h-64 overflow-hidden">
          <NeuralNetwork isActive={isActive} state={neuralState} amplitude={amplitude} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className={`text-6xl mb-4 transition-all duration-300 ${isActive ? 'text-groq-orange scale-110' : 'text-gray-400 dark:text-groq-muted scale-100'}`}>
              <Brain className="w-16 h-16 animate-pulse" />
            </div>
            <div className={`text-lg font-medium px-6 py-2 rounded-full backdrop-blur-sm ${isActive ? 'bg-groq-orange/20 text-groq-orange border border-groq-orange/30' : 'bg-gray-200/20 dark:bg-white/5 text-gray-600 dark:text-groq-muted border border-gray-300/30 dark:border-groq-border/30'}`}>
              {statusText}
            </div>
          </div>
        </div>

        <div className="panel p-4 flex items-center justify-center gap-4">
          {!continuousMode && !recording ? (
            <button
              onClick={startRecording}
              disabled={processing && !speaking}
              className="btn-primary px-8 py-4 text-lg flex items-center gap-3 disabled:opacity-50"
            >
              <Mic className="w-6 h-6" />
              {speaking && bargeIn ? 'Interrupt & Speak' : 'Press to Speak'}
            </button>
          ) : !continuousMode ? (
            <button
              onClick={stopRecording}
              className="btn px-8 py-4 text-lg bg-red-600 text-white hover:bg-red-700 flex items-center gap-3"
            >
              <MicOff className="w-6 h-6 animate-pulse" />
              Stop Recording
            </button>
          ) : (
            <div className="flex items-center gap-2 text-groq-orange">
              <Mic className="w-6 h-6 animate-pulse" />
              <span className="text-lg font-medium">Listening for &quot;{wakeWord}&quot;...</span>
            </div>
          )}

          {speaking && (
            <button onClick={stopSpeaking} className="btn-ghost px-6 py-4 flex items-center gap-2">
              <VolumeX className="w-5 h-5" />
              Stop Speaking
            </button>
          )}

          {processing && !speaking && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-groq-muted">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing…</span>
            </div>
          )}
        </div>

        {/* Text input fallback */}
        <div className="panel p-3 flex items-center gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="Type a message and press Enter (no mic needed)…"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && textInput.trim() && !processing) {
                e.preventDefault();
                const t = textInput;
                setTextInput('');
                processTextInput(t);
              }
            }}
            disabled={processing && !speaking}
          />
          <button
            onClick={() => {
              if (!textInput.trim() || processing) return;
              const t = textInput;
              setTextInput('');
              processTextInput(t);
            }}
            disabled={!textInput.trim() || (processing && !speaking)}
            className="btn-primary px-4 py-2 flex items-center gap-2 disabled:opacity-40"
            title="Send text"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>

        <div className="panel flex-1 overflow-y-auto p-4">
          {messages.length === 0 && !streamingText ? (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-groq-muted text-center">
              <div>
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No conversation yet</p>
                <p className="text-xs mt-1">Press the microphone button or type a message below</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-500/20 text-blue-500' : 'bg-groq-orange/20 text-groq-orange'}`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`flex-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    <div className={`inline-block max-w-[80%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-groq-panel border border-gray-200 dark:border-groq-border'}`}>
                      {msg.text}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-groq-muted mt-1 flex items-center gap-2">
                      <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      {msg.audioUrls && msg.audioUrls.length > 0 && (
                        <button
                          onClick={() => playMessage(msg.audioUrls!)}
                          className="hover:text-groq-orange transition-colors"
                          title="Play audio"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {streamingText && (
                <div className="flex gap-3 flex-row">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-groq-orange/20 text-groq-orange">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="inline-block max-w-[80%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap bg-gray-100 dark:bg-groq-panel border border-gray-200 dark:border-groq-border">
                      {streamingText}
                      <span className="inline-block w-2 h-4 bg-groq-orange ml-1 animate-pulse align-middle" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
