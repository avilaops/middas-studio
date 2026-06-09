'use client';

import { useEffect, useState } from 'react';

/**
 * Fetches the live model list from /api/models and returns a deduplicated array
 * of model ids matching the provided filter. Falls back to `fallback` until the
 * request succeeds (and on error).
 */
export function useGroqModels(
  filter: (id: string) => boolean,
  fallback: string[]
): string[] {
  const [models, setModels] = useState<string[]>(fallback);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/models')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const list: any[] = Array.isArray(j?.data) ? j.data : [];
        const ids = Array.from(
          new Set(
            list
              .filter((m) => m?.active !== false)
              .map((m) => m?.id)
              .filter((id: any): id is string => typeof id === 'string')
              .filter(filter)
          )
        );
        if (ids.length) setModels(ids);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return models;
}

/** Excludes audio (whisper/tts/playai), safety/guard, and prompt-guard models. */
export const isChatLikeModel = (id: string): boolean =>
  !/whisper|tts|playai|guard|prompt-guard|safety/i.test(id);

/** Reasoning-capable models: gpt-oss, deepseek-r1, qwen reasoning, etc. */
export const isReasoningModel = (id: string): boolean =>
  /gpt-oss|deepseek-r1|reasoning|qwen.*think|kimi/i.test(id);
