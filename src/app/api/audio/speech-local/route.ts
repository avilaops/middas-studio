import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, unlink, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PYTHON = process.env.PIPER_PYTHON || 'python';
const DEFAULT_MODEL =
  process.env.PIPER_MODEL_PATH || 'D:/AvilaOps/vozes/voices/en_GB-alan-medium.onnx';
const VOICES_DIR = process.env.PIPER_VOICES_DIR || dirname(DEFAULT_MODEL);

function resolveModel(voice?: string): string {
  if (!voice) return DEFAULT_MODEL;
  if (voice.endsWith('.onnx')) return join(VOICES_DIR, voice);
  return join(VOICES_DIR, `${voice}.onnx`);
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const { input, voice, length_scale, noise_scale, noise_w } = await req.json();
    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'input is required' }, { status: 400 });
    }

    const modelPath = resolveModel(voice);
    const workDir = join(tmpdir(), 'piper-tts');
    await mkdir(workDir, { recursive: true });
    const outPath = join(workDir, `${randomUUID()}.wav`);

    const script = `
import sys, wave
from piper import PiperVoice
voice = PiperVoice.load(r"${modelPath}")
with wave.open(r"${outPath}", "wb") as wav:
    voice.synthesize_wav(sys.stdin.read(), wav${
      length_scale ? `, length_scale=${Number(length_scale)}` : ''
    }${noise_scale ? `, noise_scale=${Number(noise_scale)}` : ''}${
      noise_w ? `, noise_w=${Number(noise_w)}` : ''
    })
`;

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(PYTHON, ['-c', script], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('error', reject);
      proc.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`piper exit ${code}: ${stderr}`))
      );
      proc.stdin.write(input);
      proc.stdin.end();
    });

    const buffer = await readFile(outPath);
    unlink(outPath).catch(() => {});

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'audio/wav',
        'X-Duration-Ms': String(Date.now() - start),
        'X-Provider': 'piper-local',
        'X-Voice': basename(modelPath, '.onnx'),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  let voices: string[] = [];
  try {
    const files = await readdir(VOICES_DIR);
    voices = files.filter((f) => f.endsWith('.onnx')).map((f) => basename(f, '.onnx'));
  } catch {
    /* ignore */
  }
  return NextResponse.json({
    provider: 'piper-local',
    voices_dir: VOICES_DIR,
    default_model: DEFAULT_MODEL,
    voices,
    python: PYTHON,
    usage: 'POST { input: string, voice?: string, length_scale?, noise_scale?, noise_w? }',
  });
}
