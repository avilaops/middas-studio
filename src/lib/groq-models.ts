// Client-safe constants. No server-only imports.
// Source of truth: GET /api/models (dynamic), with these as sensible fallbacks.
// Updated for Groq deprecations: llama-3.2-vision-preview, qwen-2.5-32b,
// mixtral-8x7b-32768, llama-guard-3-8b are decommissioned.

export const GROQ_MODELS = {
  chat: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'google/gemma-4-27b-it',
    'gemma2-9b-it',
  ],
  reasoning: [
    'deepseek-r1-distill-llama-70b',
    'qwen/qwen3-32b',
    'google/gemma-4-27b-it',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
  ],
  vision: [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
  ],
  guard: [
    'meta-llama/llama-guard-4-12b',
  ],
  compound: [
    'compound-beta',
    'compound-beta-mini',
  ],
  audio: {
    transcription: ['whisper-large-v3', 'whisper-large-v3-turbo', 'distil-whisper-large-v3-en'],
    translation: ['whisper-large-v3'],
    tts: ['playai-tts', 'playai-tts-arabic'],
  },
};

export const TTS_VOICES = [
  'Fritz-PlayAI', 'Arista-PlayAI', 'Atlas-PlayAI', 'Basil-PlayAI',
  'Briggs-PlayAI', 'Calum-PlayAI', 'Celeste-PlayAI', 'Cheyenne-PlayAI',
  'Chip-PlayAI', 'Cillian-PlayAI', 'Deedee-PlayAI', 'Gail-PlayAI',
  'Indigo-PlayAI', 'Mamaw-PlayAI', 'Mason-PlayAI', 'Mikail-PlayAI',
  'Mitch-PlayAI', 'Quinn-PlayAI', 'Thunder-PlayAI',
];
