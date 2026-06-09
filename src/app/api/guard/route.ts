import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';
import { logApi } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// LlamaGuard categories
const GUARD_CATEGORIES: Record<string, string> = {
  S1: 'Violent Crimes',
  S2: 'Non-Violent Crimes',
  S3: 'Sex-Related Crimes',
  S4: 'Child Sexual Exploitation',
  S5: 'Defamation',
  S6: 'Specialized Advice',
  S7: 'Privacy',
  S8: 'Intellectual Property',
  S9: 'Indiscriminate Weapons',
  S10: 'Hate',
  S11: 'Suicide & Self-Harm',
  S12: 'Sexual Content',
  S13: 'Elections',
  S14: 'Code Interpreter Abuse',
};

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const { content, role = 'user', model = 'llama-guard-3-8b' } = await req.json();
    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });

    const completion = await groq.chat.completions.create({
      model,
      messages: [{ role, content }],
    });

    const raw: string = completion.choices[0]?.message?.content || '';
    const lines = raw.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
    const verdict = (lines[0] || '').toLowerCase();
    const codes = (lines[1] || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const violations = codes.map((c: string) => ({ code: c, label: GUARD_CATEGORIES[c] || 'Unknown' }));

    const duration = Date.now() - start;
    await logApi({ module: 'guard', endpoint: '/guard', model, status_code: 200, duration_ms: duration });

    return NextResponse.json({
      safe: verdict === 'safe',
      verdict,
      violations,
      raw,
      duration_ms: duration,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
