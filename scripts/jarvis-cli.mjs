#!/usr/bin/env node
/**
 * Jarvis CLI subagent.
 *
 * Usage:
 *   node scripts/jarvis-cli.mjs "your task here"
 *   node scripts/jarvis-cli.mjs --model openai/gpt-oss-120b --max-iter 20 "your task"
 *   echo "your task" | node scripts/jarvis-cli.mjs --stdin
 *
 * Requires: groq-studio dev server running (default http://localhost:3000).
 * If APP_AUTH_TOKEN is set in .env.local, pass it via JARVIS_TOKEN env var.
 */

import { argv, env, exit, stdin } from 'node:process';
import { createInterface } from 'node:readline';

const BASE = env.JARVIS_BASE || 'http://localhost:3000';
const TOKEN = env.JARVIS_TOKEN || env.APP_AUTH_TOKEN || '';

const args = argv.slice(2);
let model;
let maxIter = 15;
let useStdin = false;
let json = false;
let quiet = false;
let allowedTools;
const positional = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--model' || a === '-m') model = args[++i];
  else if (a === '--max-iter') maxIter = Number(args[++i]);
  else if (a === '--tools') allowedTools = args[++i].split(',').map((s) => s.trim()).filter(Boolean);
  else if (a === '--stdin') useStdin = true;
  else if (a === '--json') json = true;
  else if (a === '--quiet' || a === '-q') quiet = true;
  else if (a === '--help' || a === '-h') {
    console.log(`Jarvis CLI subagent
Usage: jarvis-cli <task> [--model M] [--max-iter N] [--tools t1,t2] [--stdin] [--json] [--quiet]
Env: JARVIS_BASE (default http://localhost:3000), JARVIS_TOKEN`);
    exit(0);
  } else positional.push(a);
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    const rl = createInterface({ input: stdin });
    rl.on('line', (l) => { data += l + '\n'; });
    rl.on('close', () => resolve(data.trim()));
  });
}

const task = useStdin ? await readStdin() : positional.join(' ').trim();

if (!task) {
  console.error('No task provided. Use --help.');
  exit(2);
}

if (!quiet) console.error(`[jarvis] → ${BASE}/api/jarvis  model=${model || 'default'}  iter≤${maxIter}`);

const headers = { 'content-type': 'application/json' };
if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;

let res;
try {
  res = await fetch(`${BASE}/api/jarvis`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ task, model, max_iterations: maxIter, allowed_tools: allowedTools }),
  });
} catch (e) {
  console.error(`[jarvis] connection failed: ${e.message}`);
  console.error(`[jarvis] is groq-studio running at ${BASE}?  -> cd groq-studio; npx next dev`);
  exit(1);
}

const data = await res.json();

if (json) {
  console.log(JSON.stringify(data, null, 2));
  exit(data.ok ? 0 : 1);
}

if (!quiet && Array.isArray(data.tool_calls)) {
  for (const tc of data.tool_calls) {
    const ok = tc.result?.ok !== false;
    console.error(`  [${tc.iter}] ${ok ? '✓' : '✗'} ${tc.name} (${tc.duration_ms}ms)`);
  }
  console.error(`[jarvis] ${data.iterations} iter · ${data.duration_ms}ms · ${data.tool_calls.length} calls`);
}

if (data.error) {
  console.error(`[jarvis] error: ${data.error}`);
  exit(1);
}

console.log(data.final_text || '');
exit(0);
