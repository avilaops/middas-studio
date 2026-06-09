import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await ensureSchema();
  const url = new URL(req.url);
  const moduleName = url.searchParams.get('module');
  const limit = Number(url.searchParams.get('limit') || 100);

  try {
    const logs = moduleName
      ? await query(`SELECT * FROM api_logs WHERE module = $1 ORDER BY created_at DESC LIMIT $2`, [moduleName, limit])
      : await query(`SELECT * FROM api_logs ORDER BY created_at DESC LIMIT $1`, [limit]);

    const stats = await query(`
      SELECT module, COUNT(*) as count, AVG(duration_ms)::int as avg_ms, MAX(duration_ms) as max_ms
      FROM api_logs WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY module ORDER BY count DESC
    `);

    return NextResponse.json({ logs, stats });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, logs: [], stats: [] }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await query(`TRUNCATE api_logs`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
