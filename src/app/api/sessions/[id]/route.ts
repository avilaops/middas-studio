import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const session = await query(`SELECT * FROM chat_sessions WHERE id = $1`, [id]);
  const messages = await query(`SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY id ASC`, [id]);
  return NextResponse.json({ session: session[0], messages });
}
