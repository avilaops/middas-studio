import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureSchema();
  try {
    const list = await groq.files.list();
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const purpose = (formData.get('purpose') as string) || 'batch';
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

    const created = await groq.files.create({ file: file as any, purpose: purpose as any });

    await query(
      `INSERT INTO files_registry (groq_file_id, filename, purpose, bytes, status)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (groq_file_id) DO NOTHING`,
      [created.id, (file as any).name, purpose, (created as any).bytes || 0, (created as any).status || null]
    );

    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const r = await groq.files.delete(id);
    await query(`DELETE FROM files_registry WHERE groq_file_id = $1`, [id]);
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
