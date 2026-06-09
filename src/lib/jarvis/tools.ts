import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { query } from '@/lib/db';
import { remember as memRemember, recall as memRecall } from './memory';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const MAX_OUTPUT_BYTES = 200_000;
const DEFAULT_TIMEOUT = 120_000;

function truncate(s: string, max = MAX_OUTPUT_BYTES) {
  if (!s) return s;
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…[truncated ${s.length - max} chars]`;
}

function isUnrestricted() {
  return (process.env.JARVIS_UNRESTRICTED || 'true').toLowerCase() !== 'false';
}

async function ps(script: string, timeoutMs = DEFAULT_TIMEOUT) {
  const { stdout, stderr } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024, windowsHide: true }
  );
  return { stdout, stderr };
}

export type ToolHandler = (args: any, ctx: ToolCtx) => Promise<any> | any;

export interface ToolCtx {
  depth: number;
  runId?: number;
  parentTask?: string;
}

export const JARVIS_TOOLS: {
  schema: any;
  handler: ToolHandler;
}[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'shell_exec',
        description:
          'Execute an arbitrary shell command on the host machine (Windows PowerShell by default). Use this for ANY task that needs OS access: install packages, run scripts, query system info, control services, git, docker, npm, etc. Has full user permissions.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' },
            shell: { type: 'string', enum: ['powershell', 'cmd', 'bash'], description: 'Shell to use (default powershell on Windows)' },
            cwd: { type: 'string', description: 'Working directory (absolute path). Optional.' },
            timeout_ms: { type: 'number', description: 'Timeout in ms (default 120000)' },
          },
          required: ['command'],
        },
      },
    },
    handler: async ({ command, shell = 'powershell', cwd, timeout_ms = DEFAULT_TIMEOUT }) => {
      try {
        let stdout = '', stderr = '', exitCode = 0;
        if (shell === 'powershell') {
          const r: any = await execFileAsync(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', command],
            { timeout: timeout_ms, maxBuffer: 50 * 1024 * 1024, cwd, windowsHide: true, encoding: 'utf8' } as any
          );
          stdout = String(r.stdout); stderr = String(r.stderr);
        } else if (shell === 'cmd') {
          const r = await execAsync(command, { timeout: timeout_ms, maxBuffer: 50 * 1024 * 1024, cwd, shell: 'cmd.exe', windowsHide: true, encoding: 'utf8' } as any);
          stdout = String(r.stdout); stderr = String(r.stderr);
        } else {
          const r = await execAsync(command, { timeout: timeout_ms, maxBuffer: 50 * 1024 * 1024, cwd, shell: 'bash', encoding: 'utf8' } as any);
          stdout = String(r.stdout); stderr = String(r.stderr);
        }
        return { ok: true, exitCode, stdout: truncate(stdout), stderr: truncate(stderr) };
      } catch (e: any) {
        return {
          ok: false,
          exitCode: e.code ?? -1,
          stdout: truncate(e.stdout || ''),
          stderr: truncate(e.stderr || e.message || ''),
        };
      }
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'fs_read',
        description: 'Read a file from disk (UTF-8 or base64 for binary). Full filesystem access.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            encoding: { type: 'string', enum: ['utf8', 'base64'], default: 'utf8' },
            max_bytes: { type: 'number', default: 200000 },
          },
          required: ['path'],
        },
      },
    },
    handler: async ({ path: p, encoding = 'utf8', max_bytes = MAX_OUTPUT_BYTES }) => {
      const buf = await fs.readFile(p);
      const sliced = buf.subarray(0, max_bytes);
      return {
        ok: true,
        path: p,
        bytes: buf.length,
        truncated: buf.length > max_bytes,
        content: encoding === 'base64' ? sliced.toString('base64') : sliced.toString('utf8'),
      };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'fs_write',
        description: 'Write/overwrite a file. Creates parent dirs automatically.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
            encoding: { type: 'string', enum: ['utf8', 'base64'], default: 'utf8' },
            append: { type: 'boolean', default: false },
          },
          required: ['path', 'content'],
        },
      },
    },
    handler: async ({ path: p, content, encoding = 'utf8', append = false }) => {
      await fs.mkdir(path.dirname(p), { recursive: true });
      const data = encoding === 'base64' ? Buffer.from(content, 'base64') : content;
      if (append) await fs.appendFile(p, data as any);
      else await fs.writeFile(p, data as any);
      const stat = await fs.stat(p);
      return { ok: true, path: p, bytes: stat.size };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'fs_list',
        description: 'List a directory with optional recursion.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            recursive: { type: 'boolean', default: false },
            max_entries: { type: 'number', default: 500 },
          },
          required: ['path'],
        },
      },
    },
    handler: async ({ path: p, recursive = false, max_entries = 500 }) => {
      const out: any[] = [];
      async function walk(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          if (out.length >= max_entries) return;
          const full = path.join(dir, e.name);
          out.push({ path: full, type: e.isDirectory() ? 'dir' : 'file' });
          if (recursive && e.isDirectory()) await walk(full);
        }
      }
      await walk(p);
      return { ok: true, count: out.length, entries: out };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'fs_delete',
        description: 'Delete a file or directory (recursive). DESTRUCTIVE.',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' }, recursive: { type: 'boolean', default: false } },
          required: ['path'],
        },
      },
    },
    handler: async ({ path: p, recursive = false }) => {
      await fs.rm(p, { recursive, force: true });
      return { ok: true, deleted: p };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'fs_search',
        description: 'Search for a regex pattern across files in a directory tree (like grep). Returns matched paths + line snippets.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Root directory' },
            pattern: { type: 'string', description: 'Regex pattern' },
            include: { type: 'string', description: 'Optional file extension filter (e.g. ".ts")' },
            max_matches: { type: 'number', default: 100 },
          },
          required: ['path', 'pattern'],
        },
      },
    },
    handler: async ({ path: root, pattern, include, max_matches = 100 }) => {
      const re = new RegExp(pattern, 'i');
      const matches: any[] = [];
      async function walk(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          if (matches.length >= max_matches) return;
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            if (['node_modules', '.git', '.next', 'dist', 'build'].includes(e.name)) continue;
            await walk(full);
          } else if (!include || e.name.endsWith(include)) {
            try {
              const txt = await fs.readFile(full, 'utf8');
              const lines = txt.split(/\r?\n/);
              lines.forEach((ln, i) => {
                if (re.test(ln) && matches.length < max_matches) {
                  matches.push({ path: full, line: i + 1, text: ln.slice(0, 300) });
                }
              });
            } catch {}
          }
        }
      }
      await walk(root);
      return { ok: true, count: matches.length, matches };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'process_list',
        description: 'List running processes on the host.',
        parameters: { type: 'object', properties: { filter: { type: 'string', description: 'Optional name filter' } } },
      },
    },
    handler: async ({ filter }) => {
      const cmd = filter
        ? `Get-Process | Where-Object { $_.ProcessName -like '*${filter.replace(/'/g, "''")}*' } | Select-Object Id,ProcessName,@{n='CPU';e={[math]::Round($_.CPU,2)}},@{n='MemMB';e={[math]::Round($_.WorkingSet64/1MB,1)}} | ConvertTo-Json -Compress`
        : `Get-Process | Select-Object Id,ProcessName,@{n='CPU';e={[math]::Round($_.CPU,2)}},@{n='MemMB';e={[math]::Round($_.WorkingSet64/1MB,1)}} | ConvertTo-Json -Compress`;
      const { stdout } = await ps(cmd);
      try {
        return { ok: true, processes: JSON.parse(stdout || '[]') };
      } catch {
        return { ok: true, raw: truncate(stdout, 50_000) };
      }
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'process_kill',
        description: 'Kill a process by PID. DESTRUCTIVE.',
        parameters: { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] },
      },
    },
    handler: async ({ pid }) => {
      const { stderr } = await ps(`Stop-Process -Id ${Number(pid)} -Force`);
      return { ok: !stderr, pid, stderr: stderr || null };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'clipboard_read',
        description: 'Read the current clipboard text contents.',
        parameters: { type: 'object', properties: {} },
      },
    },
    handler: async () => {
      const { stdout } = await ps('Get-Clipboard -Raw');
      return { ok: true, text: stdout };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'clipboard_write',
        description: 'Write text to the clipboard.',
        parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      },
    },
    handler: async ({ text }) => {
      const tmp = path.join(os.tmpdir(), `jarvis-clip-${Date.now()}.txt`);
      await fs.writeFile(tmp, text, 'utf8');
      await ps(`Get-Content -Raw -LiteralPath '${tmp.replace(/'/g, "''")}' | Set-Clipboard`);
      await fs.rm(tmp).catch(() => {});
      return { ok: true, bytes: text.length };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'screen_capture',
        description: 'Take a screenshot of the primary display. Returns the file path and base64 PNG.',
        parameters: {
          type: 'object',
          properties: { return_base64: { type: 'boolean', default: false } },
        },
      },
    },
    handler: async ({ return_base64 = false }) => {
      const out = path.join(os.tmpdir(), `jarvis-shot-${Date.now()}.png`);
      const script = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp = New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); $bmp.Save('${out.replace(/\\/g, '\\\\')}',[System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose();`;
      await ps(script, 30_000);
      const stat = await fs.stat(out);
      let base64: string | undefined;
      if (return_base64) {
        const buf = await fs.readFile(out);
        base64 = buf.toString('base64');
      }
      return { ok: true, path: out, bytes: stat.size, base64 };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'vision_analyze',
        description:
          'Look at the user\'s screen (or an image file/URL) and answer a question about it using a multimodal LLM. Use this whenever the user asks about what is on screen, to read a UI, find a button, identify text in an image, etc.',
        parameters: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'What you want to know about the image. E.g. "What window is open? What error is shown?"',
            },
            source: {
              type: 'string',
              enum: ['screen', 'file', 'url'],
              default: 'screen',
            },
            path: { type: 'string', description: 'When source=file, absolute path to image.' },
            url: { type: 'string', description: 'When source=url, image URL.' },
            model: {
              type: 'string',
              description: 'Vision model. Default: meta-llama/llama-4-scout-17b-16e-instruct',
            },
          },
          required: ['prompt'],
        },
      },
    },
    handler: async ({ prompt, source = 'screen', path: imgPath, url, model }) => {
      let imageUrl: string;
      if (source === 'url') {
        if (!url) return { ok: false, error: 'url required when source=url' };
        imageUrl = url;
      } else {
        let filePath = imgPath;
        if (source === 'screen') {
          filePath = path.join(os.tmpdir(), `jarvis-vision-${Date.now()}.png`);
          const script = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp = New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); $bmp.Save('${filePath.replace(/\\/g, '\\\\')}',[System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose();`;
          await ps(script, 30_000);
        }
        if (!filePath) return { ok: false, error: 'path required when source=file' };
        const buf = await fs.readFile(filePath);
        const b64 = buf.toString('base64');
        const ext = (path.extname(filePath).slice(1) || 'png').toLowerCase();
        imageUrl = `data:image/${ext};base64,${b64}`;
      }

      const { groq } = await import('@/lib/groq');
      const completion: any = await groq.chat.completions.create({
        model: model || 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      });
      const answer = completion.choices[0]?.message?.content || '';
      return { ok: true, answer, model: completion.model };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'http_fetch',
        description: 'Make an HTTP request to any URL (no CORS, no CSP). Useful for hitting internal APIs, third-party services, scraping, etc.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            method: { type: 'string', default: 'GET' },
            headers: { type: 'object' },
            body: { type: 'string' },
            timeout_ms: { type: 'number', default: 30000 },
          },
          required: ['url'],
        },
      },
    },
    handler: async ({ url, method = 'GET', headers = {}, body, timeout_ms = 30000 }) => {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), timeout_ms);
      try {
        const r = await fetch(url, { method, headers, body, signal: ctl.signal });
        const text = await r.text();
        const ct = r.headers.get('content-type') || '';
        return {
          ok: r.ok,
          status: r.status,
          content_type: ct,
          body: truncate(text, 100_000),
          truncated: text.length > 100_000,
        };
      } catch (e: any) {
        return { ok: false, error: e.message };
      } finally {
        clearTimeout(to);
      }
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'db_query',
        description: 'Run a SQL query against the local PostgreSQL (groq_studio DB). Use for inspecting state, logs, memory.',
        parameters: {
          type: 'object',
          properties: {
            sql: { type: 'string' },
            params: { type: 'array', items: {} },
          },
          required: ['sql'],
        },
      },
    },
    handler: async ({ sql, params = [] }) => {
      try {
        const rows = await query(sql, params);
        return { ok: true, rowCount: rows.length, rows: rows.slice(0, 200) };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'memory_remember',
        description: 'Persist a long-term memory note for Jarvis (survives across conversations). Upserts by (scope, key).',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'string' },
            scope: { type: 'string', default: 'global' },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['key', 'value'],
        },
      },
    },
    handler: async ({ key, value, scope = 'global', tags = [] }) => {
      const r = await memRemember(scope, key, value, tags);
      return { ok: true, scope, key, backend: r.backend };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'memory_recall',
        description: 'Search Jarvis long-term memory (substring match on key/value, optional scope and tag filters).',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            scope: { type: 'string' },
            tag: { type: 'string' },
            limit: { type: 'number', default: 20 },
          },
        },
      },
    },
    handler: async ({ query: q, scope, tag, limit = 20 }) => {
      const r = await memRecall({ query: q, scope, tag, limit });
      return { ok: true, count: r.items.length, items: r.items, backend: r.backend };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'subagent_spawn',
        description:
          'Spawn an autonomous Jarvis sub-agent to perform a sub-task with its own tool-calling loop and budget. Returns the sub-agent final answer + transcript. Use this to decompose complex tasks (e.g. "research X", "refactor module Y", "deploy Z"). Max depth: 3.',
        parameters: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'Self-contained task description for the sub-agent' },
            model: { type: 'string', description: 'Optional override model' },
            max_iterations: { type: 'number', default: 12 },
            allowed_tools: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional whitelist of tool names; default = all',
            },
          },
          required: ['task'],
        },
      },
    },
    handler: async ({ task, model, max_iterations = 12, allowed_tools }, ctx) => {
      const { runJarvis } = await import('@/lib/jarvis/agent');
      if ((ctx?.depth ?? 0) >= 3) return { ok: false, error: 'max subagent depth (3) reached' };
      const r = await runJarvis({
        task,
        model,
        maxIterations: max_iterations,
        allowedTools: allowed_tools,
        depth: (ctx?.depth ?? 0) + 1,
        parentTask: ctx?.parentTask,
      });
      return { ...r, ok: true };
    },
  },
];

export function toolSchemas(allowed?: string[]) {
  return JARVIS_TOOLS
    .filter((t) => !allowed || allowed.includes(t.schema.function.name))
    .map((t) => t.schema);
}

export function toolHandlers(allowed?: string[]): Record<string, ToolHandler> {
  const out: Record<string, ToolHandler> = {};
  for (const t of JARVIS_TOOLS) {
    if (!allowed || allowed.includes(t.schema.function.name)) {
      out[t.schema.function.name] = t.handler;
    }
  }
  return out;
}

export { isUnrestricted };
