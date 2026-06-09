'use client';

import { useState } from 'react';
import { Image as ImageIcon, Loader2, Upload, Copy } from 'lucide-react';
import { GROQ_MODELS } from '@/lib/groq-models';
import { estimateCost, formatCost } from '@/lib/pricing';

const PROMPT_PRESETS = [
  { label: 'Describe', text: 'Describe this image in detail.' },
  { label: 'OCR', text: 'Extract all text visible in this image. Output only the text, preserving layout where possible.' },
  { label: 'Caption', text: 'Write a short, single-sentence caption for this image.' },
  { label: 'Objects', text: 'List all distinct objects you can identify in this image as a JSON array.' },
  { label: 'Chart', text: 'This is a chart or diagram. Explain what it shows and summarize the key data points.' },
  { label: 'Code from screenshot', text: 'This is a screenshot of code. Transcribe the code exactly, preserving indentation. Output only the code in a fenced block.' },
  { label: 'Accessibility', text: 'Generate concise alt text suitable for screen readers describing this image.' },
];

export default function VisionModule() {
  const [model, setModel] = useState(GROQ_MODELS.vision[0]);
  const [prompt, setPrompt] = useState('Describe this image in detail.');
  const [imageUrl, setImageUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1]);
      setImageUrl('');
    };
    reader.readAsDataURL(f);
  }

  async function run() {
    setLoading(true); setResult(null);
    try {
      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, prompt,
          image_url: imageUrl || undefined,
          image_base64: !imageUrl ? imageBase64 : undefined,
        }),
      });
      setResult(await res.json());
    } catch (e: any) {
      setResult({ error: e.message });
    } finally { setLoading(false); }
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <aside className="col-span-4 panel p-4 space-y-4">
        <div>
          <div className="label">Vision Model</div>
          <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
            {GROQ_MODELS.vision.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <div className="label">Image URL</div>
          <input className="input" placeholder="https://..." value={imageUrl}
            onChange={(e) => { setImageUrl(e.target.value); setPreview(e.target.value); setImageBase64(''); }} />
        </div>
        <div className="text-center text-xs text-gray-500 dark:text-groq-muted">— or —</div>
        <label className="btn-secondary cursor-pointer w-full flex items-center justify-center gap-2">
          <Upload className="w-4 h-4" /> Upload image
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
        <div>
          <div className="label">Prompt presets</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {PROMPT_PRESETS.map((p) => (
              <button key={p.label} onClick={() => setPrompt(p.text)}
                className="btn-ghost text-[10px] px-2 py-1">{p.label}</button>
            ))}
          </div>
          <div className="label">Prompt</div>
          <textarea aria-label="Prompt" className="input min-h-[100px]" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <button onClick={run} disabled={loading || (!imageUrl && !imageBase64)}
          className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          Analyze
        </button>
      </aside>

      <section className="col-span-8 space-y-4">
        {preview && (
          <div className="panel p-4">
            <div className="label">Preview</div>
            <img src={preview} alt="" className="max-h-80 rounded border border-gray-200 dark:border-groq-border" />
          </div>
        )}
        {result?.error && <div className="panel p-4 text-red-400 text-sm">❌ {result.error}</div>}
        {result?.choices && (
          <div className="panel p-4">
            <div className="label flex items-center justify-between">
              <span>Response</span>
              <button onClick={() => navigator.clipboard.writeText(result.choices[0].message.content)}
                className="btn-ghost text-xs flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
            </div>
            <div className="text-sm whitespace-pre-wrap">{result.choices[0].message.content}</div>
            {result.usage && (
              <div className="text-xs text-gray-500 dark:text-groq-muted mt-3 pt-3 border-t border-gray-200 dark:border-groq-border flex gap-3">
                <span>Tokens: {result.usage.total_tokens}</span>
                <span>Latency: {result.duration_ms}ms</span>
                <span className="text-groq-orange">Cost: {formatCost(estimateCost(model, result.usage.prompt_tokens || 0, result.usage.completion_tokens || 0))}</span>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
