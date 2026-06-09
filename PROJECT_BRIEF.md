# PROJECT_BRIEF — Groq Studio

> **Source of truth** mantido pelo Producer (Remy). Atualizar nas seções 7 e 8 ao fim de cada sprint.

---

## 1. Visão

Interface unificada (Next.js 14 + TypeScript + PostgreSQL) que expõe **toda** a API Groq em uma única aplicação web com 16+ módulos em abas — chat, reasoning, vision, tools, compound, guard, áudio (STT/TTS/voice chat), files, batches, models, embeddings, LangChain agent/knowledge, e auditoria com analytics.

## 2. Objetivos

- Cobertura **completa** dos endpoints Groq em UI single-page.
- Auditoria/observabilidade nativa: sessions, API logs e usage analytics em Postgres.
- Segurança opcional: bearer token + rate limit por IP via middleware.
- Onboarding em < 5 min (cp .env, createdb, npm run dev).

## 3. Não-objetivos

- Não é um cliente comercial multi-tenant (single-user / single-key).
- Não substitui a Platform AvilaOps — é uma ferramenta interna de exploração.
- Sem mobile/nativo. Apenas web.

## 4. Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| Linguagem | TypeScript strict |
| DB | PostgreSQL (`pg`), schema auto-aplicado |
| Estilo | Tailwind CSS (tema dark Groq) |
| SDKs | `groq-sdk`, `@langchain/groq`, `langchain` |
| Validação | Zod 4 |
| Pacote | pnpm 11 |

## 5. Arquitetura

```
src/
├── middleware.ts                  # auth bearer + rate limit
├── app/
│   ├── page.tsx                   # shell com abas dos módulos
│   ├── api/                       # rotas server (uma por módulo)
│   │   ├── chat | reasoning | vision | tools | compound | guard
│   │   ├── audio/{speech,speech-local,transcribe,translate}
│   │   ├── embeddings | files | batches | models
│   │   ├── langchain/{agent,knowledge}
│   │   ├── s2s | compare
│   │   ├── sessions | history | usage
│   │   └── settings/{api-key,validate}
├── components/modules/            # UI por módulo (Chat, Vision, TTS, ...)
├── db/schema.sql                  # tabelas: sessions, api_logs, usage
└── lib/                           # groq client, db, pricing, logger, types
```

## 6. Módulos (status atual)

### LLM
- [x] Chat (streaming, JSON mode, JSON Schema)
- [x] Reasoning (DeepSeek-R1, Qwen-QwQ)
- [x] Vision (Llama 3.2 multimodal)
- [x] Tools (function calling, registry server-side)
- [x] Compound (agentic + web search + code exec)
- [x] Guard (LlamaGuard-3 + Prompt Guard 2)
- [x] Compare (side-by-side de modelos)

### Áudio
- [x] Transcribe (Whisper, upload + mic ao vivo)
- [x] Translate (Whisper → EN)
- [x] TTS (PlayAI, 19 vozes)
- [x] Voice Chat / S2S (STT → LLM → TTS)
- [x] Neural Assistant (módulo dedicado)

### Plataforma & Avançado
- [x] Files, Batches, Models, Embeddings
- [x] LangChain Agent + Knowledge base

### Auditoria (Postgres)
- [x] Sessions, History (API logs), Usage analytics

## 7. Estado atual (sprint corrente)

- **Sprint:** 1 (security & ops baseline)
- **Branch principal:** `main`
- **Última atualização:** 14/05/2026
- **Build:** CI configurada em PR #1; bloqueada pela ausência de `pnpm-lock.yaml` em `main` (PR #22 em vôo resolve).
- **Mergeado neste sprint:**
  - PR #1 — CI workflow (lint + typecheck + build).
  - PR #2 — fix RCE: remoção do tool `code_exec` do LangChain agent (commit `70d35534`).
  - PR #19 — `/api/health` endpoint com DB/schema status (commit `7fc8c58a`).
- **Resolvido por auditoria (sem código):**
  - Issue #6 — cookie `groq_api_key` já tinha `HttpOnly + Secure (prod) + SameSite=Strict + Path=/`.
- **Em vôo:**
  - PR #16 — calculator com `mathjs` (precisa rebase em cima de PR #2; comentado).
  - PR #21 — comparação constant-time do `APP_AUTH_TOKEN` (delegado a Copilot agent).
  - PR #22 — adicionar `pnpm-lock.yaml` para destravar CI (delegado a Copilot agent).
- **Issues abertas:** #3 (calculator — coberta por PR #16), #4 (timing — coberta por PR #21), #5 (rate limit — aguarda decisão arquitetural), #7 (`@ts-ignore`), #8 (`groq.ts` tipado), #10 (testes), #11 (`exhaustive-deps`), #20 (CI/pnpm — coberta por PR #22).

## 8. Próximos passos

1. Aguardar Copilot agent finalizar PR #16, #21, #22 e mergear na ordem: #22 → #21 → #16 (CI primeiro, depois fixes).
2. Sprint 2 candidato: decidir #5 (rate limit: single-instance documentado vs. Redis vs. Postgres) e fechar tech-debt minors (#7, #8, #11) num único PR.
3. Sprint 2 também deve cobrir #10 (bootstrap de testes Vitest + Harness) para gerar coverage report.
4. Validar integração com `auth.avilaops.com` se a ferramenta for exposta fora da rede interna.

## 9. Segurança & Operação

- `APP_AUTH_TOKEN` — se definido, exige `Authorization: Bearer …` em `/api/*`.
- `RATE_LIMIT_PER_MIN` — token bucket por IP (default 60).
- `GROQ_API_KEY` — **server-side only**, nunca exposta ao cliente.
- DB credentials via `DATABASE_URL` ou `PG*` envs.

## 10. Variáveis de ambiente

```env
GROQ_API_KEY=gsk_...
DATABASE_URL=postgresql://user:pass@host:5432/groq_studio
APP_AUTH_TOKEN=          # opcional
RATE_LIMIT_PER_MIN=60    # opcional
```

## 11. Comandos

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build
pnpm start
pnpm lint
```

## 12. Equipe AI (papéis)

- **Remy** (Producer) — plano, triagem, merge. (este arquivo)
- **Kira** (Product) — escopo, prioridades de UX.
- **Milo** (Art) — tema, layout, ícones.
- **Nova** (Frontend) — `components/modules/*`, `app/page.tsx`.
- **Sage** (Backend) — `app/api/*`, `lib/*`, schema SQL.
- **Ivy** (QA) — testes, smoke, regressão.

---

_Atualize seções **7** e **8** ao fim de cada sprint. Demais seções só mudam em re-escopo._
