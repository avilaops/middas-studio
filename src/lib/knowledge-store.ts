// In-memory knowledge base for the LangChain agent.
// BM25-lite scoring (no embeddings needed → works without OpenAI/Cohere keys).

export type Chunk = {
  id: string;
  source: string;
  text: string;
  tokens: string[];
  tf: Record<string, number>;
  length: number;
};

const STOPWORDS = new Set([
  'the','a','an','and','or','but','of','for','on','in','to','at','by','with','as','is','are','was','were',
  'be','been','being','it','its','this','that','these','those','from','i','you','he','she','they','we',
  'do','does','did','have','has','had','will','would','can','could','should','may','might','not','no',
  'so','if','than','then','there','here','what','when','where','who','why','how','all','any','some','o','a','os','as','de','do','da','dos','das','um','uma','para','com','que','no','na','nos','nas','e','ou','é','são','foi','será','sera','muito','pouco',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function chunkText(text: string, size = 800, overlap = 100): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= size) return [clean];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    out.push(clean.slice(i, i + size));
    i += size - overlap;
  }
  return out;
}

class KnowledgeStore {
  private chunks: Chunk[] = [];
  private docFreq: Record<string, number> = {};

  list() {
    return this.chunks.map((c) => ({ id: c.id, source: c.source, preview: c.text.slice(0, 120), length: c.text.length }));
  }

  size() {
    return this.chunks.length;
  }

  add(source: string, text: string): number {
    const pieces = chunkText(text);
    let added = 0;
    for (const piece of pieces) {
      const tokens = tokenize(piece);
      if (!tokens.length) continue;
      const tf: Record<string, number> = {};
      for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
      const seen = new Set(tokens);
      for (const t of seen) this.docFreq[t] = (this.docFreq[t] || 0) + 1;
      this.chunks.push({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        source,
        text: piece,
        tokens,
        tf,
        length: tokens.length,
      });
      added++;
    }
    return added;
  }

  remove(id: string): boolean {
    const idx = this.chunks.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    const removed = this.chunks[idx];
    this.chunks.splice(idx, 1);
    const seen = new Set(removed.tokens);
    for (const t of seen) {
      this.docFreq[t] = (this.docFreq[t] || 0) - 1;
      if (this.docFreq[t] <= 0) delete this.docFreq[t];
    }
    return true;
  }

  clear() {
    this.chunks = [];
    this.docFreq = {};
  }

  // BM25 search
  search(query: string, k = 4) {
    if (!this.chunks.length) return [];
    const q = tokenize(query);
    if (!q.length) return [];

    const N = this.chunks.length;
    const avgLen = this.chunks.reduce((s, c) => s + c.length, 0) / N;
    const k1 = 1.5;
    const b = 0.75;

    const scored = this.chunks.map((c) => {
      let score = 0;
      for (const term of q) {
        const tf = c.tf[term] || 0;
        if (!tf) continue;
        const df = this.docFreq[term] || 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * (c.length / avgLen)));
        score += idf * norm;
      }
      return { chunk: c, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((s) => ({
        id: s.chunk.id,
        source: s.chunk.source,
        text: s.chunk.text,
        score: Number(s.score.toFixed(3)),
      }));
  }
}

// Module-level singleton (per Node process)
const g = globalThis as any;
if (!g.__flow182_knowledge_store) {
  g.__flow182_knowledge_store = new KnowledgeStore();
}
export const knowledgeStore: KnowledgeStore = g.__flow182_knowledge_store;
