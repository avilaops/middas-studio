# 🎨 Midda Studio Code

## O que faz

**Midda Studio Code** é uma plataforma **all-in-one** que expõe a totalidade da **API Groq** em uma interface web unificada. É um estúdio interativo com **16+ módulos** em uma única tela com abas, permitindo explorar e testar todas as capacidades do Groq (chat, reasoning, visão, áudio, files, batches, modelos, etc.) com suporte completo a PostgreSQL para auditoria e analytics.

**Funcionalidades principais:**
- 💬 **Chat** - Streaming, JSON mode, JSON Schema (structured outputs)
- 🧠 **Reasoning** - DeepSeek-R1, Qwen-QwQ com chain-of-thought
- 👁️ **Vision** - Análise de imagens com Llama 3.2 multimodal
- 🔧 **Tool Use** - Function calling com registry server-side
- ⚡ **Compound** - Sistema agentic com web search + code execution
- 🛡️ **Guard** - LlamaGuard-3 + Prompt Guard 2 (moderação)
- 🎙️ **Áudio** - Transcribe, Translate, TTS, Voice Chat (STT→LLM→TTS)
- 📁 **Files/Batches** - Upload e processamento em lote
- 📊 **Auditoria** - Sessions, API Logs, Usage Analytics (PostgreSQL)
- 🖥️ **Desktop** - Versão .exe via Electron

---

## Para quem faz

- **Desenvolvedores** explorando a API Groq
- **Pesquisadores** testando modelos de IA avançados
- **Equipes técnicas** auditando e analisando uso de IA
- **Empresas** usando Groq em produção (observabilidade nativa)
- **Engenheiros de IA** prototipando aplicações multimodais

---

## Como executa

**Midda Studio Code** é uma aplicação **Next.js + TypeScript** que funciona em 3 modos:

### 1️⃣ Modo Web (Default)
```bash
pnpm dev  # http://localhost:3000
```
- Single-page application com 16 abas
- PostgreSQL para persistência
- Interface React interativa

### 2️⃣ Modo Desktop (Electron)
```bash
pnpm electron:dev  # Abre janela Electron
pnpm electron:build:win  # Gera .exe
```
- Aplicação standalone em Windows/macOS/Linux
- Distribuível como instalador NSIS

### 3️⃣ Modo Produção
```bash
pnpm build
pnpm start  # http://localhost:3000
```
- Build otimizado para produção
- Pode ser deployado em Docker, Vercel, etc.

**Fluxo de execução interno:**
1. Cliente (React) envia requisição ao endpoint `/api/<módulo>`
2. Middleware valida Bearer token e rate limit
3. Servidor Node.js (Next.js) formata requisição e envia ao Groq
4. Resposta é logada em PostgreSQL
5. Resultado é retornado ao cliente (streaming ou JSON)

---

## Do que precisa para executar

### Requisitos de Sistema
- **Node.js** ≥ 18.x (recomendado 20.x)
- **pnpm** ≥ 10.x (ou npm/yarn)
- **PostgreSQL** ≥ 13.x (local ou remoto)
- Conexão com internet (para API Groq)

### Dependências do Projeto

**Frontend/Framework:**
- `next` 14.2.15 - Framework React
- `react` 18.3.1 - UI library
- `typescript` 5.6.3 - Type safety
- `tailwindcss` 3.4.13 - Styling
- `lucide-react` - Icons

**Backend/IA:**
- `groq-sdk` 0.7.0 - SDK oficial Groq
- `@langchain/groq` 1.2.0 - LangChain integration
- `@langchain/core` 1.1.41
- `langchain` 1.3.4
- `pg` 8.13.1 - PostgreSQL driver
- `zod` 4.3.6 - Schema validation

**Desktop:**
- `electron` 32.3.3 - App desktop
- `electron-builder` 25.1.8 - Build para Windows/macOS/Linux
- `electron-is-dev` 3.0.1

**Markdown/Rendering:**
- `react-markdown` 9.0.1
- `remark-gfm` 4.0.1

---

## Chaves de APIs necessárias

### 1️⃣ Groq API Key (OBRIGATÓRIO)

**O que é:** Token de autenticação para acessar a API Groq

**Como obter:**
1. Acesse https://console.groq.com
2. Faça login ou crie uma conta
3. Navegue até "API Keys"
4. Clique em "Create New Secret Key"
5. Copie a chave (formato: `gsk_...`)

**Modelos disponíveis:**
- `llama-3.3-70b-versatile` (recomendado)
- `llama-3.1-405b-reasoning` (reasoning)
- `qwen-qwq-32b-preview` (reasoning alternativo)
- `mixtral-8x7b-32768`
- `gemma-2-9b-it`
- `llama-3.2-90b-vision-preview` (vision)
- `whisper-large-v3-turbo` (audio)

### 2️⃣ Replicate API Token (OPCIONAL)

**O que é:** Para image generation avançada

**Como obter:**
1. Acesse https://replicate.com
2. Faça login com GitHub
3. Vá para "API Tokens"
4. Copie seu token

### 3️⃣ Stability API Key (OPCIONAL)

**O que é:** Alternativa para image generation

**Como obter:**
1. Acesse https://platform.stability.ai
2. Crie uma conta
3. Gere uma API key

### 4️⃣ PostgreSQL Credentials (OBRIGATÓRIO)

**O que é:** Acesso ao banco de dados

**Como configurar:**
```bash
# Criar database localmente
createdb midda_studio

# Ou usar variáveis de ambiente
PGHOST=localhost
PGPORT=5432
PGDATABASE=midda_studio
PGUSER=postgres
PGPASSWORD=seu_senha
```

---

## Procedimento de instalação

### 1️⃣ Pré-requisitos

**Instalar Node.js e pnpm:**
```bash
# Verificar Node.js (deve ser ≥18)
node --version

# Instalar pnpm (se não tiver)
npm install -g pnpm

# Verificar pnpm
pnpm --version
```

**Instalar PostgreSQL:**
- **Windows/macOS:** Baixe de https://www.postgresql.org/download/
- **Linux (Ubuntu):** `sudo apt install postgresql postgresql-contrib`

### 2️⃣ Clonar e configurar

```bash
# Clonar repositório
git clone <seu-repo>
cd midda-studiocode

# Instalar dependências
pnpm install

# Criar arquivo .env.local
cp .env.example .env.local
```

### 3️⃣ Configurar variáveis de ambiente

**Edite `.env.local`:**

```env
# OBRIGATÓRIO
GROQ_API_KEY=gsk_sua_chave_aqui

# OBRIGATÓRIO (escolha uma forma)
# Opção A: URL única
DATABASE_URL=postgresql://postgres:senha@localhost:5432/midda_studio

# Opção B: Variáveis individuais
PGHOST=localhost
PGPORT=5432
PGDATABASE=midda_studio
PGUSER=postgres
PGPASSWORD=sua_senha

# OPCIONAL (para image generation)
REPLICATE_API_TOKEN=seu_token_aqui
STABILITY_API_KEY=sua_chave_aqui

# OPCIONAL (segurança)
APP_AUTH_TOKEN=seu_token_secreto  # Se definido, todos /api/* exigem Bearer token
RATE_LIMIT_PER_MIN=60             # Limite de requisições por minuto

# OPCIONAL (TTS local via Piper)
PIPER_PYTHON=python
PIPER_MODEL_PATH=/caminho/para/modelo.onnx
```

### 4️⃣ Criar banco de dados

```bash
# Criar database PostgreSQL
createdb midda_studio

# O schema será criado automaticamente na primeira requisição à API
```

### 5️⃣ Rodar a aplicação

**Modo desenvolvimento (web):**
```bash
pnpm dev
# Acesse http://localhost:3000
```

**Modo desenvolvimento (desktop):**
```bash
pnpm electron:dev
# Abre janela Electron com a aplicação
```

**Modo produção:**
```bash
pnpm build
pnpm start
# Acesse http://localhost:3000
```

### 6️⃣ Verificar instalação

1. Abra http://localhost:3000
2. Selecione aba "Chat"
3. Digite uma mensagem
4. Se receber resposta, tudo está funcionando ✅

---

## Estrutura dos Módulos

### 🧠 Módulos LLM

| Aba | Descrição | Modelo | API |
|---|---|---|---|
| **Chat** | Conversa com streaming, JSON mode, structured outputs | llama-3.3-70b | `/api/chat` |
| **Reasoning** | Chain-of-thought com DeepSeek-R1 / Qwen-QwQ | llama-3.1-405b | `/api/reasoning` |
| **Vision** | Análise de imagens, upload ou URL | llama-3.2-90b-vision | `/api/vision` |
| **Tool Use** | Function calling com handlers server-side | llama-3.3-70b | `/api/tools` |
| **Compound** | Agentic com web search + code execution | compound-beta | `/api/compound` |
| **Guard** | Moderação de conteúdo (LlamaGuard-3) | llama-guard-3-8b | `/api/guard` |
| **Compare** | Comparação side-by-side de modelos | múltiplos | `/api/compare` |

### 🎙️ Módulos Áudio

| Aba | Descrição | Modelo | API |
|---|---|---|---|
| **Transcribe** | Transcrição de áudio (upload ou mic ao vivo) | whisper-large-v3-turbo | `/api/audio/transcribe` |
| **Translate** | Tradução de áudio para inglês | whisper-large-v3-turbo | `/api/audio/translate` |
| **TTS** | Text-to-speech com 19 vozes (en/ar) | playai-tts | `/api/audio/speech` |
| **Voice Chat** | Pipeline STT → LLM → TTS ao vivo | múltiplos | `/api/s2s` |
| **Neural Assistant** | Chat com voz e sincronização labial | múltiplos | `/api/neural` |

### 📁 Módulos Plataforma

| Aba | Descrição | API |
|---|---|---|
| **Files** | Upload, listagem e remoção de arquivos | `/api/files` |
| **Batches** | Processamento em lote (24h-7d, -25% cost) | `/api/batches` |
| **Models** | Lista de modelos disponíveis | `/api/models` |
| **Embeddings** | Geração de embeddings (v1) | `/api/embeddings` |

### 📊 Módulos Auditoria

| Aba | Descrição | DB |
|---|---|---|
| **Sessions** | Histórico de sessões persistidas | `chat_sessions` |
| **API Logs** | Log completo de todas as requisições | `api_logs` |
| **Usage** | Analytics: tokens, latência, cost, timeline | agregações |

---

## Segurança

### 1️⃣ Autenticação (Bearer Token)
Se `APP_AUTH_TOKEN` estiver definido em `.env.local`, todas as requisições em `/api/*` devem incluir:
```bash
Authorization: Bearer seu_token_secreto
```

### 2️⃣ Rate Limiting
Token bucket por IP:
- Padrão: 60 requisições por minuto
- Configurável via `RATE_LIMIT_PER_MIN` em `.env.local`
- Implementado em `src/middleware.ts`

### 3️⃣ Groq API Key
- Armazenada **server-side only** em `.env.local`
- **Nunca** exposta ao cliente
- Pode ser rotacionada sem reiniciar a aplicação

### 4️⃣ PostgreSQL Credentials
- Armazenadas em `DATABASE_URL` ou variáveis `PGHOST`, etc.
- Conectadas via `pg` com SSL opcional em produção

---

## Variáveis de Ambiente

```env
# ===== OBRIGATÓRIAS =====

GROQ_API_KEY=gsk_...
# Chave de API do Groq para acessar modelos

DATABASE_URL=postgresql://user:pass@localhost:5432/midda_studio
# OU (modo individual):
PGHOST=localhost
PGPORT=5432
PGDATABASE=midda_studio
PGUSER=postgres
PGPASSWORD=senha

# ===== OPCIONAIS =====

APP_AUTH_TOKEN=seu_token_secreto
# Se definido, exige Bearer token em /api/*

RATE_LIMIT_PER_MIN=60
# Limite de requisições por minuto (default 60)

REPLICATE_API_TOKEN=seu_token
# Para image generation via Replicate

STABILITY_API_KEY=sua_chave
# Para image generation via Stability AI

PIPER_PYTHON=python
PIPER_MODEL_PATH=/caminho/modelo.onnx
# Para TTS local via Piper (offline)

NODE_ENV=development
# 'development' ou 'production'

NEXT_TELEMETRY_DISABLED=1
# Desabilitar telemetria Next.js (recomendado)
```

---

## Arquitetura

```
midda-studiocode/
├── src/
│   ├── middleware.ts                    # Auth + rate limit
│   ├── app/
│   │   ├── page.tsx                     # 16 abas principais
│   │   ├── layout.tsx                   # Layout global
│   │   ├── globals.css
│   │   └── api/
│   │       ├── chat/route.ts            # Streaming, JSON Schema
│   │       ├── reasoning/route.ts       # DeepSeek-R1, Qwen-QwQ
│   │       ├── vision/route.ts          # Llama 3.2 multimodal
│   │       ├── tools/route.ts           # Function calling
│   │       ├── compound/route.ts        # Agentic + web search
│   │       ├── guard/route.ts           # LlamaGuard-3
│   │       ├── compare/route.ts         # Compare side-by-side
│   │       ├── audio/
│   │       │   ├── transcribe/route.ts
│   │       │   ├── translate/route.ts
│   │       │   └── speech/route.ts
│   │       ├── s2s/route.ts             # Speech-to-speech pipeline
│   │       ├── files/route.ts
│   │       ├── batches/route.ts
│   │       ├── models/route.ts
│   │       ├── embeddings/route.ts
│   │       ├── history/route.ts         # API logs
│   │       ├── usage/route.ts           # Analytics
│   │       ├── sessions/route.ts        # Chat sessions
│   │       └── health/route.ts          # Health check
│   ├── components/
│   │   ├── modules/                     # 16 módulos UI
│   │   │   ├── ChatModule.tsx
│   │   │   ├── ReasoningModule.tsx
│   │   │   ├── VisionModule.tsx
│   │   │   ├── ToolUseModule.tsx
│   │   │   ├── CompoundModule.tsx
│   │   │   ├── GuardModule.tsx
│   │   │   ├── AudioTranscribeModule.tsx
│   │   │   ├── AudioTtsModule.tsx
│   │   │   ├── VoiceChatModule.tsx
│   │   │   ├── FilesModule.tsx
│   │   │   ├── BatchesModule.tsx
│   │   │   ├── ModelsModule.tsx
│   │   │   ├── EmbeddingsModule.tsx
│   │   │   ├── SessionsModule.tsx
│   │   │   ├── ApiLogsModule.tsx
│   │   │   └── UsageModule.tsx
│   │   └── common/                      # Componentes reutilizáveis
│   ├── lib/
│   │   ├── groq.ts                      # Cliente Groq + consts
│   │   ├── db.ts                        # Pool PostgreSQL + schema init
│   │   ├── logger.ts                    # Logging
│   │   ├── types.ts                     # Tipos TypeScript globais
│   │   └── utils.ts                     # Helpers
│   └── db/
│       └── schema.sql                   # Schema PostgreSQL (8 tabelas)
├── electron/
│   ├── main.js                          # Processo principal Electron
│   └── preload.js                       # Segurança Electron
├── public/
│   ├── icon.ico
│   ├── icon.png
│   └── ...assets
├── Dockerfile                           # Multi-stage build
├── docker-compose.yml                   # Composição com PostgreSQL
├── package.json                         # Scripts e deps
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── README.md
```

---

## Schema PostgreSQL

O schema é **criado automaticamente** na primeira requisição. Tabelas:

```sql
-- 1. Sessions e mensagens
CREATE TABLE chat_sessions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES chat_sessions(id),
  role VARCHAR(10),
  content TEXT,
  model VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Auditoria
CREATE TABLE api_logs (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255),
  method VARCHAR(10),
  status_code INT,
  request_time INT,
  model VARCHAR(100),
  tokens_in INT,
  tokens_out INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Áudio
CREATE TABLE audio_jobs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50),  -- transcribe, translate, tts
  file_url TEXT,
  result TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Vision
CREATE TABLE vision_requests (
  id SERIAL PRIMARY KEY,
  image_url TEXT,
  query TEXT,
  result TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Files & Batches
CREATE TABLE files_registry (
  id SERIAL PRIMARY KEY,
  groq_file_id VARCHAR(255),
  filename VARCHAR(255),
  size_bytes INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE batches_registry (
  id SERIAL PRIMARY KEY,
  groq_batch_id VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Tool calls
CREATE TABLE tool_calls_log (
  id SERIAL PRIMARY KEY,
  tool_name VARCHAR(255),
  arguments TEXT,
  result TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Docker

**Rodar com Docker Compose:**

```bash
docker-compose up
# PostgreSQL rodará em localhost:5432
# Midda Studio em localhost:3000
```

**Build manual:**

```bash
docker build -t midda-studio:latest .
docker run -p 3000:3000 \
  -e GROQ_API_KEY=gsk_... \
  -e DATABASE_URL=postgresql://... \
  midda-studio:latest
```

---

## Comandos úteis

```bash
# Desenvolvimento
pnpm dev                  # Web em http://localhost:3000

# Desktop (Electron)
pnpm electron:dev        # Modo desenvolvimento
pnpm electron:build:win  # Build para Windows (.exe)

# Build e produção
pnpm build               # Próximas otimizações
pnpm start               # Rodar produção
pnpm lint                # ESLint

# Database
pnpm db:init             # Inicializar schema

# CLI (Midda)
pnpm midda               # Interface CLI

# Copilot (backend standalone)
cd ../midda-copilot && pnpm start

# Extensão Windsurf
cd ../midda-windsurf-extension && pnpm compile
```

---

## Troubleshooting

### ❌ Erro: `GROQ_API_KEY is required`
**Solução:** Verifique se `.env.local` contém `GROQ_API_KEY=gsk_...`

### ❌ Erro: `database "midda_studio" does not exist`
**Solução:** Execute `createdb midda_studio` ou configure `DATABASE_URL` correto

### ❌ Erro: `connect ECONNREFUSED 127.0.0.1:5432`
**Solução:** PostgreSQL não está rodando. Inicie com `sudo systemctl start postgresql` (Linux) ou abra PostgreSQL.app (macOS)

### ❌ Respostas lentas
**Solução:** Use modelos menores (`gemma-2-9b-it`) ou aumente rate limit se estiver testando

### ❌ Erro: `ExtensionContextNotSet`
**Solução:** Recarregue a extensão Windsurf (Ctrl+Shift+P → Reload Window)

---

## Integração com Ferramentas Midda

### 🤖 Midda Copilot (Backend)
```bash
cd ../midda-copilot
pnpm start
```
- API REST independente em `http://localhost:3001`
- Use como backend para integrações externas

### 🪟 Midda Windsurf Extension
```bash
cd ../midda-windsurf-extension
pnpm compile
```
- Extensão para VS Code / Windsurf
- Comandos: Explain, Fix, Refactor, Generate Tests
- Aperto rápido: Ctrl+Shift+M (Chat)

### 📜 Midda CLI
```bash
pnpm midda
```
- Interface de linha de comando
- Chat, transcription, TTS

---

## Roadmap

- [ ] Integração com auth.avilaops.com
- [ ] Testes automatizados (Vitest)
- [ ] Coverage report (>80%)
- [ ] Redis para rate limiting distribuído
- [ ] Suporte a WebSockets para colaboração real-time
- [ ] Mobile app (React Native)
- [ ] Análise de sentiment
- [ ] Custom model fine-tuning

---

## Contribuindo

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/minha-feature`)
3. Commit suas mudanças (`git commit -m 'Add nova feature'`)
4. Push para a branch (`git push origin feature/minha-feature`)
5. Abra um Pull Request

---

## Equipe

| Papel | Membro |
|---|---|
| **Producer** | Remy |
| **Product** | Kira |
| **Design** | Milo |
| **Frontend** | Nova |
| **Backend** | Sage |
| **QA** | Ivy |

---

## Licença

Proprietário - Midda Inc.

---

## Suporte

Para dúvidas ou problemas:
- 📧 Email: support@midda.com
- 🐛 Issues: GitHub Issues
- 💬 Discord: [Link do servidor]
- 📚 Docs: [docs.midda.com]

---

**Última atualização:** Janeiro 2025

**Versão:** 1.0.0

**Status:** ✅ Produção
