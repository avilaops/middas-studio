import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';
import { logApi } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  try {
    const models = await groq.models.list();
    await logApi({
      module: 'models',
      endpoint: '/models',
      status_code: 200,
      duration_ms: Date.now() - start,
    });
    return NextResponse.json(models);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
