-- Groq Studio Database Schema
-- PostgreSQL

CREATE TABLE IF NOT EXISTS chat_sessions (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Chat',
  model TEXT NOT NULL,
  system_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system','user','assistant','tool')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tokens_in INTEGER,
  tokens_out INTEGER,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_logs (
  id SERIAL PRIMARY KEY,
  module TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  model TEXT,
  request JSONB,
  response JSONB,
  status_code INTEGER,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audio_jobs (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('transcription','translation','tts')),
  model TEXT NOT NULL,
  input_filename TEXT,
  output_text TEXT,
  output_audio_path TEXT,
  language TEXT,
  duration_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vision_requests (
  id SERIAL PRIMARY KEY,
  model TEXT NOT NULL,
  prompt TEXT,
  image_url TEXT,
  response TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS files_registry (
  id SERIAL PRIMARY KEY,
  groq_file_id TEXT UNIQUE,
  filename TEXT NOT NULL,
  purpose TEXT NOT NULL,
  bytes INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS batches_registry (
  id SERIAL PRIMARY KEY,
  groq_batch_id TEXT UNIQUE,
  input_file_id TEXT,
  endpoint TEXT,
  status TEXT,
  metadata JSONB,
  completion_window TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tool_calls_log (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES chat_sessions(id) ON DELETE SET NULL,
  function_name TEXT NOT NULL,
  arguments JSONB,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jarvis_memory (
  id SERIAL PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'global',
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (scope, key)
);

CREATE TABLE IF NOT EXISTS jarvis_runs (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES jarvis_runs(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  model TEXT NOT NULL,
  iterations INTEGER NOT NULL DEFAULT 0,
  tool_calls JSONB,
  final_text TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_module ON api_logs(module);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jarvis_memory_key ON jarvis_memory(scope, key);
CREATE INDEX IF NOT EXISTS idx_jarvis_runs_parent ON jarvis_runs(parent_id);
