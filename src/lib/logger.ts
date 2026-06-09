import { query } from './db';
import type { ApiLog } from './types';

export async function logApi(entry: ApiLog) {
  try {
    await query(
      `INSERT INTO api_logs (module, endpoint, model, request, response, status_code, duration_ms, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        entry.module,
        entry.endpoint,
        entry.model || null,
        entry.request ? JSON.stringify(entry.request) : null,
        entry.response ? JSON.stringify(entry.response) : null,
        entry.status_code || null,
        entry.duration_ms || null,
        entry.error || null,
      ]
    );
  } catch (e) {
    console.warn('[logApi] failed:', (e as Error).message);
  }
}
