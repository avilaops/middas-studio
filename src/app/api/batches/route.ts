import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureSchema();
  try {
    const list = await groq.batches.list();
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  try {
    const {
      input_file_id,
      endpoint = '/v1/chat/completions',
      completion_window = '24h',
      metadata,
    } = await req.json();

    const created = await groq.batches.create({
      input_file_id,
      endpoint,
      completion_window,
      metadata,
    } as any);

    await query(
      `INSERT INTO batches_registry (groq_batch_id, input_file_id, endpoint, status, metadata, completion_window)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (groq_batch_id) DO UPDATE SET status = EXCLUDED.status`,
      [created.id, input_file_id, endpoint, created.status, JSON.stringify(metadata || {}), completion_window]
    );

    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const r = await groq.batches.cancel(id);
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
