'use client';

import { useState } from 'react';
import { Binary, Loader2 } from 'lucide-react';

export default function EmbeddingsModule() {
  const [input, setInput] = useState('Groq runs LLMs really fast.\nLPUs are purpose-built inference chips.');
  const [model, setModel] = useState('nomic-embed-text-v1.5');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true); setResult(null);
    try {
      const lines = input.split('\n').filter(Boolean);
      const res = await fetch('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: lines, model }),
      });
      setResult(await res.json());
    } catch (e: any) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  }

  function cosine(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <aside className="col-span-4 panel p-4 space-y-4">
        <div>
          <div className="label">Model</div>
          <select aria-label="Embedding model" className="input" value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="nomic-embed-text-v1.5">nomic-embed-text-v1.5</option>
            <option value="nomic-embed-text-v1">nomic-embed-text-v1</option>
          </select>
        </div>
        <div className="text-xs text-gray-500 dark:text-groq-muted">
          Insira um texto por linha. Será calculada similaridade do cosseno entre todos os pares.
        </div>
        <button onClick={run} disabled={loading || !input.trim()}
          className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Binary className="w-4 h-4" />}
          Compute embeddings
        </button>
      </aside>

      <section className="col-span-8 space-y-3">
        <div className="panel p-4">
          <div className="label">Input texts (one per line)</div>
          <textarea aria-label="Texts" className="input min-h-[120px] font-mono text-xs" value={input}
            onChange={(e) => setInput(e.target.value)} />
        </div>

        {result?.error && (
          <div className="panel p-4 text-red-400 text-sm">
            ❌ {result.error}
            {result.hint && <div className="text-xs text-gray-500 dark:text-groq-muted mt-2">{result.hint}</div>}
          </div>
        )}

        {result?.data && (
          <>
            <div className="panel p-4">
              <div className="label">Vectors ({result.data.length})</div>
              <div className="space-y-2 mt-2">
                {result.data.map((d: any, i: number) => (
                  <div key={i} className="text-xs font-mono text-gray-500 dark:text-groq-muted">
                    [{i}] dim={d.embedding.length} · preview: [{d.embedding.slice(0, 5).map((n: number) => n.toFixed(4)).join(', ')}, ...]
                  </div>
                ))}
              </div>
            </div>

            {result.data.length >= 2 && (
              <div className="panel p-4">
                <div className="label">Cosine similarity matrix</div>
                <table className="text-xs mt-2">
                  <tbody>
                    {result.data.map((a: any, i: number) => (
                      <tr key={i}>
                        {result.data.map((b: any, j: number) => {
                          const sim = cosine(a.embedding, b.embedding);
                          const intensity = Math.max(0, sim);
                          return (
                            <td key={j} className="px-2 py-1 text-center font-mono"
                              style={{ background: `rgba(245,80,54,${intensity * 0.6})` }}>
                              {sim.toFixed(3)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
