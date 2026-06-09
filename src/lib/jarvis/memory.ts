import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { query } from '@/lib/db';

const FILE = path.join(os.homedir(), '.jarvis', 'memory.json');

type Entry = { scope: string; key: string; value: string; tags: string[]; updated_at: string };

async function readFileStore(): Promise<Entry[]> {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeFileStore(items: Entry[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(items, null, 2), 'utf8');
}

export async function remember(scope: string, key: string, value: string, tags: string[] = []) {
  try {
    await query(
      `INSERT INTO jarvis_memory (scope,key,value,tags) VALUES ($1,$2,$3,$4)
       ON CONFLICT (scope,key) DO UPDATE SET value=EXCLUDED.value, tags=EXCLUDED.tags, updated_at=NOW()`,
      [scope, key, value, tags]
    );
    return { backend: 'postgres' as const };
  } catch {
    const items = await readFileStore();
    const idx = items.findIndex((e) => e.scope === scope && e.key === key);
    const entry: Entry = { scope, key, value, tags, updated_at: new Date().toISOString() };
    if (idx >= 0) items[idx] = entry;
    else items.push(entry);
    await writeFileStore(items);
    return { backend: 'file' as const };
  }
}

export async function recall({
  query: q,
  scope,
  tag,
  limit = 20,
}: {
  query?: string;
  scope?: string;
  tag?: string;
  limit?: number;
}) {
  const lim = Math.min(Number(limit) || 20, 200);
  try {
    const where: string[] = [];
    const params: any[] = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(key ILIKE $${params.length} OR value ILIKE $${params.length})`);
    }
    if (scope) {
      params.push(scope);
      where.push(`scope = $${params.length}`);
    }
    if (tag) {
      params.push(tag);
      where.push(`$${params.length} = ANY(tags)`);
    }
    const sql = `SELECT scope,key,value,tags,updated_at FROM jarvis_memory ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY updated_at DESC LIMIT ${lim}`;
    const rows = await query(sql, params);
    return { backend: 'postgres' as const, items: rows };
  } catch {
    const items = await readFileStore();
    const ql = q?.toLowerCase();
    const filtered = items.filter((e) => {
      if (scope && e.scope !== scope) return false;
      if (tag && !e.tags.includes(tag)) return false;
      if (ql && !(e.key.toLowerCase().includes(ql) || e.value.toLowerCase().includes(ql))) return false;
      return true;
    });
    filtered.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    return { backend: 'file' as const, items: filtered.slice(0, lim) };
  }
}
