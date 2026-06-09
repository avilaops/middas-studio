import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Midda Studio Code · Toda a API Groq em uma só interface',
  description:
    'Chat, reasoning, vision, voz, agentes, embeddings e auditoria — 16+ módulos prontos com latência ultra-baixa via Groq LPU. Por AvilaOps.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
