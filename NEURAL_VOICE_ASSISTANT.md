# 🤖 Neural Voice Assistant - Groq Studio

## ✅ Assistente de Voz com IA Neural Implementado

### 🎯 Visão Geral

O **Neural Voice Assistant** é um assistente de IA conversacional completo que permite interação por voz com visualização de rede neural em tempo real.

### ✨ Características Principais

#### 🎤 Entrada por Voz
- **Gravação de áudio** via microfone do navegador
- **Transcrição automática** usando Whisper (Groq)
- **Detecção de fala** com feedback visual
- Suporte para gravações contínuas

#### 🧠 Processamento Neural
- **LLM customizável** - Escolha qualquer modelo do Groq
- **System prompt personalizável** - Configure o comportamento do assistente
- **Contexto de conversação** - Mantém histórico completo
- Pipeline completo: **STT → LLM → TTS**

#### 🔊 Saída por Voz
- **Síntese de voz** usando PlayAI TTS
- **19 vozes diferentes** para escolher
- **Auto-play opcional** das respostas
- Reprodução manual de mensagens anteriores

#### 🎨 Visualização Neural
- **Rede neural animada** em tempo real
- **Efeitos visuais reativos** ao estado (gravando, processando, falando)
- **Animação de nós e conexões** fluida
- Cor laranja (Groq) quando ativa, cinza quando inativa

### 📋 Fluxo de Funcionamento

```
1. 🎤 Usuário: Pressiona "Press to Speak"
2. 🎙️ Sistema: Grava áudio do microfone
3. 🛑 Usuário: Pressiona "Stop Recording"
4. 📝 Sistema: Transcreve áudio → texto (Whisper)
5. 🧠 Sistema: Processa com LLM (Llama/Gemma/etc)
6. 🔊 Sistema: Gera fala da resposta (PlayAI TTS)
7. ▶️ Sistema: Reproduz áudio automaticamente
8. 💬 Interface: Mostra conversação completa
9. 🔄 Repete para próxima interação
```

### 🎛️ Configurações Disponíveis

#### LLM Model
- Todos os modelos de chat disponíveis no Groq
- Padrão: `llama-3.3-70b-versatile`
- Inclui Gemma 4, Llama 4, GPT-OSS, etc.

#### Voice (19 opções)
- **Arista-PlayAI** (padrão - feminina)
- Fritz-PlayAI (masculina)
- Celeste-PlayAI (feminina)
- Mason-PlayAI (masculina)
- Thunder-PlayAI (profunda)
- +14 outras vozes

#### System Prompt
- Personalizável completamente
- Padrão: "You are a helpful AI assistant. Keep your responses clear and concise for voice interaction."
- Otimizado para respostas por voz

#### Auto-speak
- ✅ Ativado: Responde automaticamente por voz
- ❌ Desativado: Apenas texto, reprodução manual

### 🎨 Interface

#### Visualização Neural (Topo)
- Canvas animado com rede neural
- 5 camadas de neurônios (6→10→8→6→4)
- Conexões ponderadas aleatórias
- Animação responsiva ao estado

#### Controles Centrais
- **Press to Speak** - Inicia gravação
- **Stop Recording** - Finaliza e processa
- **Stop Speaking** - Para áudio em reprodução
- Feedback visual do estado atual

#### Histórico de Conversação
- Mensagens do usuário (azul, à direita)
- Mensagens do assistente (laranja, à esquerda)
- Timestamp de cada mensagem
- Botão para reproduzir áudio de cada resposta

### 📁 Arquivos Criados

1. **[src/components/NeuralNetwork.tsx](src/components/NeuralNetwork.tsx)**
   - Componente de visualização da rede neural
   - Canvas animado em tempo real
   - Efeitos visuais reativos

2. **[src/components/modules/NeuralAssistantModule.tsx](src/components/modules/NeuralAssistantModule.tsx)**
   - Módulo principal do assistente
   - Integração completa STT→LLM→TTS
   - Gerenciamento de estado e áudio

3. **[src/app/page.tsx](src/app/page.tsx)** (modificado)
   - Adicionado ícone `Bot`
   - Novo grupo "Assistant" no topo
   - Tab "Neural Voice AI" como padrão

### 🚀 Como Usar

#### 1. Acesse o Assistente
- Abra **http://localhost:3000**
- O Neural Voice AI já está selecionado por padrão
- Ou clique em "Neural Voice AI" na sidebar

#### 2. Configure (Opcional)
- Escolha um modelo LLM diferente
- Selecione uma voz que você goste
- Ajuste o system prompt
- Ative/desative auto-speak

#### 3. Converse
- Clique em **"Press to Speak"**
- Permita acesso ao microfone (se solicitado)
- Fale sua pergunta ou comando
- Clique em **"Stop Recording"**
- Aguarde o processamento (a rede neural ficará laranja)
- Ouça a resposta (se auto-speak estiver ativo)

#### 4. Continue a Conversa
- O histórico é mantido automaticamente
- Cada nova mensagem usa o contexto anterior
- Você pode reproduzir qualquer resposta clicando no ícone 🔊

### 🎯 Casos de Uso

#### Assistente Pessoal
```
"Qual o clima hoje?"
"Me conte uma piada"
"Explique o que é inteligência artificial"
```

#### Tutor Educacional
```
System: "You are a patient teacher explaining concepts simply."
Pergunta: "Como funciona a fotossíntese?"
```

#### Companheiro de Estudo
```
System: "You are a study buddy. Ask quiz questions."
Pergunta: "Me teste sobre história do Brasil"
```

#### Tradutor de Voz
```
System: "Translate user's speech to English and respond in English."
Pergunta: "Olá, como vai?"
```

### ⚙️ Pipeline Técnico

```
┌─────────────────────────────────────────────────┐
│  NEURAL VOICE ASSISTANT PIPELINE                │
└─────────────────────────────────────────────────┘

1. AUDIO CAPTURE
   MediaRecorder API → audio/webm blob

2. SPEECH-TO-TEXT (Whisper)
   POST /api/audio/transcribe
   Model: whisper-large-v3-turbo
   Output: Texto transcrito

3. LLM PROCESSING
   POST /api/chat
   Model: Configurável (Llama/Gemma/etc)
   Input: System + History + User text
   Output: Resposta do assistente

4. TEXT-TO-SPEECH (PlayAI)
   POST /api/audio/speech
   Model: playai-tts
   Voice: Configurável (19 opções)
   Output: audio/wav blob

5. AUDIO PLAYBACK
   HTMLAudioElement → Reprodução automática
   
6. HISTORY UPDATE
   Adiciona mensagem ao histórico
   Mantém contexto para próxima interação
```

### 🎨 Temas

O Neural Voice Assistant suporta **totalmente** os modos claro e escuro:

#### Modo Escuro
- Fundo preto (#0A0A0A)
- Rede neural cinza/laranja
- Mensagens do assistente com borda cinza

#### Modo Claro
- Fundo branco (#FFFFFF)
- Rede neural cinza/laranja (adaptado)
- Mensagens do assistente com borda clara

### 🔧 Personalizações Avançadas

#### Modificar Comportamento
Edite o system prompt para diferentes personalidades:

```typescript
// Assistente formal
"You are a professional assistant. Use formal language."

// Assistente casual
"You are a friendly buddy. Use casual, fun language."

// Especialista
"You are an expert in [área]. Provide detailed technical answers."
```

#### Ajustar Velocidade de Fala
No código, modifique o parâmetro `speed` (0.25 a 4.0):
```typescript
speed: 1.0  // Normal
speed: 1.5  // Mais rápido
speed: 0.75 // Mais devagar
```

### 📊 Estatísticas

- **Modelos suportados**: Todos do Groq (15+)
- **Vozes disponíveis**: 19 (PlayAI)
- **Idiomas**: Multi-idioma (Whisper)
- **Latência típica**: 2-5 segundos (STT→LLM→TTS)
- **Qualidade**: Alta (Whisper V3 Turbo + PlayAI Premium)

### 🆕 Diferenciais

✨ **Único no Groq Studio:**
- Primeira implementação de assistente de voz visual
- Rede neural animada em tempo real
- Pipeline completo integrado
- UX otimizada para voz

🚀 **Vantagens sobre S2S Module:**
- Visualização neural impressionante
- Histórico visual de conversação
- Controles mais intuitivos
- Design focado em assistente pessoal

### 🎓 Próximos Passos Sugeridos

1. ✅ Teste com diferentes vozes
2. ✅ Experimente modelos maiores/menores
3. ✅ Crie system prompts especializados
4. ⚡ Adicione atalhos de teclado (espaço para gravar)
5. 🎨 Personalize cores da rede neural
6. 💾 Salve conversações favoritas
7. 🌍 Adicione seletor de idioma

---

**O Neural Voice Assistant está pronto para uso!** 🎉

Acesse em **http://localhost:3000** e experimente conversar com a IA! 🤖🎤
