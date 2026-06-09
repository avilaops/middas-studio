import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureSchema();
  const sessions = await query(`
    SELECT s.*, COUNT(m.id) as message_count
    FROM chat_sessions s
    LEFT JOIN chat_messages m ON m.session_id = s.id
    GROUP BY s.id
    ORDER BY s.updated_at DESC
    LIMIT 50
  `);
  return NextResponse.json({ sessions });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (id) await query(`DELETE FROM chat_sessions WHERE id = $1`, [id]);
  else await query(`TRUNCATE chat_sessions CASCADE`);
  return NextResponse.json({ ok: true });
}
