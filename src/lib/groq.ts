import 'server-only';
import Groq from 'groq-sdk';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'groq_api_key';

function resolveKey(): string {
  try {
    const c = cookies().get(COOKIE_NAME);
    if (c?.value) return c.value;
  } catch {
    // cookies() throws outside request scope (build-time, etc.)
  }
  return process.env.GROQ_API_KEY || 'placeholder-key-not-set';
}

function createClient(): any {
  return new Groq({ apiKey: resolveKey() });
}

// Proxy creates a fresh client on each property access so the API key
// can be overridden at runtime via HttpOnly cookie set from the Settings UI.
export const groq: any = new Proxy({}, {
  get(_t, prop) {
    return createClient()[prop];
  },
});

export const GROQ_COOKIE_NAME = COOKIE_NAME;

// Re-export client-safe constants so existing route imports keep working.
export { GROQ_MODELS, TTS_VOICES } from './groq-models';
