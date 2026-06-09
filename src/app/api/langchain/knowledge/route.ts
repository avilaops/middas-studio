import { NextRequest, NextResponse } from 'next/server';
import { knowledgeStore } from '@/lib/knowledge-store';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    count: knowledgeStore.size(),
    chunks: knowledgeStore.list(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { source = 'untitled', text } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    const added = knowledgeStore.add(source, text);
    return NextResponse.json({ added, total: knowledgeStore.size() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'invalid body' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    const ok = knowledgeStore.remove(id);
    return NextResponse.json({ removed: ok, total: knowledgeStore.size() });
  }
  knowledgeStore.clear();
  return NextResponse.json({ cleared: true, total: 0 });
}
