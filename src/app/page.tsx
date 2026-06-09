import Link from 'next/link';
import {
  Sparkles,
  MessageSquare,
  Brain,
  Eye,
  Wrench,
  Layers,
  ShieldCheck,
  Mic,
  Volume2,
  Languages,
  FileText,
  Database,
  GitCompare,
  BarChart3,
  Workflow,
  Zap,
  ArrowRight,
  Check,
  Github,
  Lock,
  Cpu,
  Activity,
} from 'lucide-react';

const AUTH_URL = 'https://auth.avilaops.com';
const APP_URL = '/unified';

const modules = [
  { icon: MessageSquare, name: 'Chat', desc: 'Streaming, JSON mode e JSON Schema' },
  { icon: Brain, name: 'Reasoning', desc: 'DeepSeek-R1 e Qwen-QwQ com chain-of-thought' },
  { icon: Eye, name: 'Vision', desc: 'Llama 3.2 multimodal: imagem + texto' },
  { icon: Wrench, name: 'Tools', desc: 'Function calling com registry server-side' },
  { icon: Layers, name: 'Compound', desc: 'Agentic + web search + code exec' },
  { icon: ShieldCheck, name: 'Guard', desc: 'LlamaGuard-3 e Prompt Guard 2' },
  { icon: Mic, name: 'Transcribe', desc: 'Whisper com upload e microfone ao vivo' },
  { icon: Languages, name: 'Translate', desc: 'Whisper para tradução em tempo real' },
  { icon: Volume2, name: 'TTS', desc: 'PlayAI com 19 vozes neurais' },
  { icon: Activity, name: 'Voice Chat', desc: 'STT → LLM → TTS de baixa latência' },
  { icon: FileText, name: 'Files & Batches', desc: 'Processamento em lote da Groq' },
  { icon: Database, name: 'Embeddings', desc: 'Knowledge base e busca semântica' },
  { icon: Workflow, name: 'LangChain Agent', desc: 'Agentes com ferramentas customizadas' },
  { icon: GitCompare, name: 'Compare', desc: 'Side-by-side de modelos no mesmo prompt' },
  { icon: BarChart3, name: 'Usage Analytics', desc: 'Auditoria completa em Postgres' },
  { icon: Cpu, name: 'Models', desc: 'Catálogo vivo dos modelos Groq' },
];

const benefits = [
  {
    icon: Zap,
    title: 'Inferência ultra-rápida',
    desc: 'Aproveita LPUs da Groq para latências de poucos ms em modelos abertos.',
  },
  {
    icon: ShieldCheck,
    title: 'Auditoria nativa',
    desc: 'Sessions, API logs e métricas de uso persistidos em PostgreSQL.',
  },
  {
    icon: Lock,
    title: 'Chave protegida',
    desc: 'API key vive só no servidor. Bearer token + rate limit por IP no middleware.',
  },
  {
    icon: Workflow,
    title: '16+ módulos prontos',
    desc: 'Toda a superfície da API Groq em uma única SPA, sem trocar de contexto.',
  },
];

const plans = [
  {
    name: 'Starter',
    price: 'Grátis',
    desc: 'Para explorar a plataforma com sua própria API key.',
    features: [
      'Acesso a todos os 16+ módulos',
      'Bring your own Groq API key',
      'Auditoria local em Postgres',
      'Suporte da comunidade',
    ],
    cta: 'Criar conta',
    href: AUTH_URL,
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 'R$ 97',
    suffix: '/mês',
    desc: 'Para times que precisam de observabilidade e escala.',
    features: [
      'Tudo do Starter',
      'Observability dashboard (n8n + métricas)',
      'Armazenamento S3-compatível (MinIO)',
      'Rate limit configurável',
      'Suporte prioritário',
    ],
    cta: 'Começar agora',
    href: AUTH_URL,
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Sob consulta',
    desc: 'Deploy dedicado, SSO e SLA.',
    features: [
      'Deploy on-premise ou private cloud',
      'SSO + RBAC',
      'SLA 99.9%',
      'Onboarding dedicado',
    ],
    cta: 'Falar com vendas',
    href: 'mailto:vendas@avilaops.com',
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-[#1D1D1F] dark:text-[#E8E8EA]">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-[#1F1F22] bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F55036] to-orange-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold tracking-tight">Midda Studio Code</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600 dark:text-[#8A8A93]">
            <a href="#features" className="hover:text-[#1D1D1F] dark:hover:text-white transition-colors">Recursos</a>
            <a href="#modules" className="hover:text-[#1D1D1F] dark:hover:text-white transition-colors">Módulos</a>
            <a href="#pricing" className="hover:text-[#1D1D1F] dark:hover:text-white transition-colors">Planos</a>
            <a href="#faq" className="hover:text-[#1D1D1F] dark:hover:text-white transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={AUTH_URL}
              className="hidden sm:inline-flex text-sm text-gray-600 dark:text-[#8A8A93] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
            >
              Entrar
            </a>
            <a
              href={AUTH_URL}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F55036] hover:bg-orange-600 text-white text-sm font-medium transition-colors"
            >
              Criar conta
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(245,80,54,0.15),transparent_60%)]"
        />
        <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 dark:border-[#1F1F22] bg-gray-50 dark:bg-[#111113] text-xs text-gray-600 dark:text-[#8A8A93] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F55036] animate-pulse" />
            Powered by Groq LPU · Llama, DeepSeek, Whisper, PlayAI
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] max-w-4xl mx-auto">
            Toda a API Groq.
            <br />
            <span className="bg-gradient-to-r from-[#F55036] to-orange-500 bg-clip-text text-transparent">
              Em uma só interface.
            </span>
          </h1>

          <p className="mt-8 text-lg md:text-xl text-gray-600 dark:text-[#8A8A93] max-w-2xl mx-auto leading-relaxed">
            Chat, reasoning, vision, voz, agentes, embeddings, batches e auditoria —
            16+ módulos prontos para explorar e operar modelos de ponta com latência absurda.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={AUTH_URL}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#F55036] hover:bg-orange-600 text-white font-medium transition-colors shadow-lg shadow-orange-500/20"
            >
              Criar conta gratuita
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href={APP_URL}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-gray-200 dark:border-[#1F1F22] hover:border-[#F55036]/50 bg-white dark:bg-[#111113] font-medium transition-colors"
            >
              Acessar Studio
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap justify-center items-center gap-x-8 gap-y-3 text-xs text-gray-500 dark:text-[#6E6E73]">
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#F55036]" /> Sem cartão de crédito</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#F55036]" /> Setup em menos de 5 minutos</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#F55036]" /> Bring your own API key</span>
          </div>
        </div>

        {/* preview mock */}
        <div className="relative max-w-6xl mx-auto px-6 pb-24">
          <div className="rounded-2xl border border-gray-200 dark:border-[#1F1F22] bg-gray-50 dark:bg-[#111113] p-2 shadow-2xl shadow-orange-500/5">
            <div className="rounded-xl bg-white dark:bg-[#0A0A0A] border border-gray-100 dark:border-[#1F1F22] overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100 dark:border-[#1F1F22]">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
                <span className="ml-3 text-xs text-gray-400 dark:text-[#6E6E73] font-mono">midda-studio.app</span>
              </div>
              <div className="grid grid-cols-12 min-h-[380px]">
                <aside className="col-span-3 border-r border-gray-100 dark:border-[#1F1F22] p-4 space-y-1 text-xs">
                  {modules.slice(0, 8).map((m, i) => (
                    <div
                      key={m.name}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-md ${
                        i === 1
                          ? 'bg-[#F55036]/10 text-[#F55036]'
                          : 'text-gray-500 dark:text-[#8A8A93]'
                      }`}
                    >
                      <m.icon className="w-3.5 h-3.5" />
                      {m.name}
                    </div>
                  ))}
                </aside>
                <div className="col-span-9 p-6 space-y-3">
                  <div className="text-xs text-gray-400 dark:text-[#6E6E73] font-mono">reasoning · deepseek-r1-distill-llama-70b</div>
                  <div className="space-y-2">
                    <div className="inline-block max-w-[80%] px-3.5 py-2.5 rounded-lg bg-gray-100 dark:bg-[#111113] text-sm">
                      Explique transformers em 3 frases, com analogia visual.
                    </div>
                  </div>
                  <div className="space-y-2 text-right">
                    <div className="inline-block max-w-[80%] px-3.5 py-2.5 rounded-lg bg-[#F55036]/10 border border-[#F55036]/20 text-sm text-left">
                      <span className="text-[#F55036]">▍</span> Transformers leem todas as palavras de uma frase ao mesmo tempo, como olhar um mapa inteiro em vez de andar rua por rua...
                    </div>
                  </div>
                  <div className="pt-2 flex gap-2 text-[10px] text-gray-400 dark:text-[#6E6E73] font-mono">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#111113]">↑ 842 tok/s</span>
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#111113]">latency 218ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section id="features" className="border-t border-gray-200 dark:border-[#1F1F22] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <div className="text-sm font-medium text-[#F55036] mb-3">Por que Midda Studio</div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Construído para operar IA generativa em produção.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="p-6 rounded-xl border border-gray-200 dark:border-[#1F1F22] bg-white dark:bg-[#111113] hover:border-[#F55036]/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[#F55036]/10 flex items-center justify-center mb-4">
                  <b.icon className="w-5 h-5 text-[#F55036]" />
                </div>
                <h3 className="font-semibold mb-2">{b.title}</h3>
                <p className="text-sm text-gray-600 dark:text-[#8A8A93] leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section id="modules" className="border-t border-gray-200 dark:border-[#1F1F22] py-24 bg-gray-50/50 dark:bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <div className="text-sm font-medium text-[#F55036] mb-3">Módulos</div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              16+ módulos prontos para usar.
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-[#8A8A93]">
              Cobertura completa da API Groq + integrações com LangChain, PostgreSQL e MinIO.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {modules.map((m) => (
              <div
                key={m.name}
                className="p-5 rounded-xl border border-gray-200 dark:border-[#1F1F22] bg-white dark:bg-[#111113] hover:bg-gray-50 dark:hover:bg-[#15151A] transition-colors"
              >
                <m.icon className="w-5 h-5 text-[#F55036] mb-3" />
                <h3 className="font-medium text-sm mb-1">{m.name}</h3>
                <p className="text-xs text-gray-500 dark:text-[#8A8A93] leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-gray-200 dark:border-[#1F1F22] py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-sm font-medium text-[#F55036] mb-3">Como funciona</div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Do cadastro à primeira inferência em 3 passos.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: '01', title: 'Crie sua conta', desc: 'Cadastro unificado AvilaOps com SSO em todos os produtos.' },
              { n: '02', title: 'Conecte sua API key', desc: 'Cole sua chave Groq (ou use a do workspace). Fica server-side.' },
              { n: '03', title: 'Explore os módulos', desc: 'Chat, voz, vision, agentes. Tudo com logs e métricas automáticas.' },
            ].map((s) => (
              <div key={s.n}>
                <div className="text-5xl font-bold text-[#F55036]/30 mb-4 font-mono">{s.n}</div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-gray-600 dark:text-[#8A8A93] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-t border-gray-200 dark:border-[#1F1F22] py-24 bg-gray-50/50 dark:bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-sm font-medium text-[#F55036] mb-3">Planos</div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Comece de graça. Escale quando precisar.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative p-8 rounded-2xl border bg-white dark:bg-[#111113] transition-colors ${
                  p.highlighted
                    ? 'border-[#F55036] shadow-xl shadow-orange-500/10'
                    : 'border-gray-200 dark:border-[#1F1F22]'
                }`}
              >
                {p.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#F55036] text-white text-xs font-medium">
                    Mais popular
                  </div>
                )}
                <h3 className="text-lg font-semibold mb-1">{p.name}</h3>
                <p className="text-sm text-gray-600 dark:text-[#8A8A93] mb-6">{p.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{p.price}</span>
                  {p.suffix && <span className="text-gray-500 dark:text-[#8A8A93] ml-1">{p.suffix}</span>}
                </div>
                <a
                  href={p.href}
                  className={`block text-center px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    p.highlighted
                      ? 'bg-[#F55036] hover:bg-orange-600 text-white'
                      : 'bg-gray-100 dark:bg-[#1A1A1F] hover:bg-gray-200 dark:hover:bg-[#252530] text-[#1D1D1F] dark:text-white'
                  }`}
                >
                  {p.cta}
                </a>
                <ul className="mt-8 space-y-3 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#F55036] mt-0.5 flex-shrink-0" />
                      <span className="text-gray-600 dark:text-[#C5C5CB]">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-gray-200 dark:border-[#1F1F22] py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-sm font-medium text-[#F55036] mb-3">FAQ</div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Perguntas frequentes</h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'Preciso ter uma conta Groq?',
                a: 'Sim. O Midda Studio Code consome a API oficial da Groq usando sua própria chave (gsk_...). Ela é armazenada apenas no servidor, nunca exposta ao navegador.',
              },
              {
                q: 'Como funciona o cadastro?',
                a: 'O cadastro é feito via auth.avilaops.com — o SSO unificado de todos os produtos AvilaOps. Uma conta dá acesso a todo o ecossistema.',
              },
              {
                q: 'Posso rodar self-hosted?',
                a: 'Sim. O plano Enterprise inclui imagem Docker oficial, suporte a deploy on-premise e integração com seu IdP corporativo.',
              },
              {
                q: 'Tem suporte a português?',
                a: 'Sim. Interface, voz (TTS/STT) e modelos multilíngues estão prontos para PT-BR.',
              },
            ].map((f) => (
              <details
                key={f.q}
                className="group p-6 rounded-xl border border-gray-200 dark:border-[#1F1F22] bg-white dark:bg-[#111113]"
              >
                <summary className="flex items-center justify-between cursor-pointer font-medium list-none">
                  {f.q}
                  <span className="text-[#F55036] group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <p className="mt-4 text-sm text-gray-600 dark:text-[#8A8A93] leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="border-t border-gray-200 dark:border-[#1F1F22] py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight">
            Pronto para acelerar?
          </h2>
          <p className="mt-6 text-lg text-gray-600 dark:text-[#8A8A93] max-w-xl mx-auto">
            Crie sua conta gratuita e comece a usar os modelos mais rápidos do mundo em minutos.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={AUTH_URL}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#F55036] hover:bg-orange-600 text-white font-medium transition-colors shadow-lg shadow-orange-500/20"
            >
              Criar conta gratuita
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href={AUTH_URL}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-gray-200 dark:border-[#1F1F22] hover:border-[#F55036]/50 bg-white dark:bg-[#111113] font-medium transition-colors"
            >
              Já tenho conta · Entrar
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 dark:border-[#1F1F22] py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F55036] to-orange-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-medium">Midda Studio Code</span>
            <span className="text-xs text-gray-400 dark:text-[#6E6E73] ml-2">por AvilaOps</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-[#8A8A93]">
            <a href={AUTH_URL} className="hover:text-[#1D1D1F] dark:hover:text-white transition-colors">Entrar</a>
            <a href={AUTH_URL} className="hover:text-[#1D1D1F] dark:hover:text-white transition-colors">Cadastro</a>
            <a href="mailto:vendas@avilaops.com" className="hover:text-[#1D1D1F] dark:hover:text-white transition-colors">Contato</a>
            <a
              href="https://github.com/avilaops/middas"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
          </div>

          <div className="text-xs text-gray-400 dark:text-[#6E6E73]">
            © {new Date().getFullYear()} AvilaOps. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
