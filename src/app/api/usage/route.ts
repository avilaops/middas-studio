import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await ensureSchema();
  const url = new URL(req.url);
  const days = Number(url.searchParams.get('days') || 7);

  try {
    const totals = await query<any>(`
      SELECT
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE status_code = 200) as success_calls,
        COUNT(*) FILTER (WHERE status_code != 200 OR error IS NOT NULL) as error_calls,
        AVG(duration_ms)::int as avg_latency_ms,
        MAX(duration_ms) as max_latency_ms,
        MIN(duration_ms) as min_latency_ms
      FROM api_logs
      WHERE created_at > NOW() - ($1::int * INTERVAL '1 day')
    `, [days]);

    const byModule = await query<any>(`
      SELECT module,
        COUNT(*) as calls,
        AVG(duration_ms)::int as avg_ms,
        COUNT(*) FILTER (WHERE error IS NOT NULL) as errors
      FROM api_logs
      WHERE created_at > NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY module ORDER BY calls DESC
    `, [days]);

    const byModel = await query<any>(`
      SELECT model,
        COUNT(*) as calls,
        AVG(duration_ms)::int as avg_ms,
        SUM(COALESCE((response->'usage'->>'prompt_tokens')::int, 0)) as prompt_tokens,
        SUM(COALESCE((response->'usage'->>'completion_tokens')::int, 0)) as completion_tokens,
        SUM(COALESCE((response->'usage'->>'total_tokens')::int, 0)) as total_tokens
      FROM api_logs
      WHERE model IS NOT NULL AND created_at > NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY model ORDER BY calls DESC LIMIT 20
    `, [days]);

    const timeline = await query<any>(`
      SELECT
        date_trunc('hour', created_at) as bucket,
        COUNT(*) as calls,
        AVG(duration_ms)::int as avg_ms
      FROM api_logs
      WHERE created_at > NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY bucket ORDER BY bucket ASC
    `, [days]);

    return NextResponse.json({
      totals: totals[0] || {},
      by_module: byModule,
      by_model: byModel,
      timeline,
      days,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
