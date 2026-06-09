// Approximate Groq pricing (USD per 1M tokens) — sync with https://groq.com/pricing
// Used for cost estimation only; actual billing comes from Groq.
export const MODEL_PRICING: Record<string, { input: number; output: number; unit?: string }> = {
  // Llama 3.x
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'llama3-70b-8192': { input: 0.59, output: 0.79 },
  'llama3-8b-8192': { input: 0.05, output: 0.08 },
  // Llama 4
  'meta-llama/llama-4-scout-17b-16e-instruct': { input: 0.11, output: 0.34 },
  'meta-llama/llama-4-maverick-17b-128e-instruct': { input: 0.20, output: 0.60 },
  // OpenAI OSS (via Groq)
  'openai/gpt-oss-120b': { input: 0.15, output: 0.75 },
  'openai/gpt-oss-20b': { input: 0.10, output: 0.50 },
  // Gemma
  'google/gemma-4-27b-it': { input: 0.20, output: 0.20 },
  'gemma2-9b-it': { input: 0.20, output: 0.20 },
  // Reasoning
  'deepseek-r1-distill-llama-70b': { input: 0.75, output: 0.99 },
  'qwen/qwen3-32b': { input: 0.29, output: 0.59 },
  // Guard
  'meta-llama/llama-guard-4-12b': { input: 0.20, output: 0.20 },
  // Audio (per hour / per char)
  'whisper-large-v3': { input: 0, output: 0, unit: '$0.111/hour' },
  'whisper-large-v3-turbo': { input: 0, output: 0, unit: '$0.04/hour' },
  'distil-whisper-large-v3-en': { input: 0, output: 0, unit: '$0.02/hour' },
  'playai-tts': { input: 50, output: 0, unit: '$50/1M chars' },
  'playai-tts-arabic': { input: 50, output: 0, unit: '$50/1M chars' },
  // Compound
  'compound-beta': { input: 0.59, output: 0.79 },
  'compound-beta-mini': { input: 0.05, output: 0.08 },
};

export function estimateCost(model: string, inputTokens = 0, outputTokens = 0): number {
  const p = MODEL_PRICING[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export function formatCost(usd: number): string {
  if (usd < 0.001) return `$${(usd * 1000).toFixed(4)}m`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
