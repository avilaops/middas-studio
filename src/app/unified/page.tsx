'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings, Send, Image as ImageIcon, Mic, Volume2, Sparkles, Brain, MessageSquare, X } from 'lucide-react';

type Mode = 'chat' | 'image' | 'audio' | 'voice';

export default function UnifiedPage() {
  const [mode, setMode] = useState<Mode>('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    chatModel: 'llama-3.3-70b-versatile',
    imageModel: 'flux-pro',
    audioModel: 'whisper-large-v3-turbo',
    voiceModel: 'playai-tts',
    voice: 'Arista-PlayAI',
    temperature: 0.7,
    maxTokens: 1024,
    // BYOK - Bring Your Own Key
    groqApiKey: '',
    deepSeekApiKey: '',
    ollamaUrl: 'http://localhost:11434',
    replicateApiToken: '',
    stabilityApiKey: '',
    openaiApiKey: '',
    anthropicApiKey: '',
    sweApiKey: '',
    // Provider selection
    chatProvider: 'groq', // groq, deepseek, ollama, openai, anthropic, swe
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessing(true);

    try {
      if (mode === 'chat') {
        let apiUrl = '/api/chat';
        let requestBody: any = {
          messages: [...messages, { role: 'user', content: userMessage }],
          model: settings.chatModel,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
        };

        // Add API key based on provider
        if (settings.chatProvider === 'groq' && settings.groqApiKey) {
          requestBody.apiKey = settings.groqApiKey;
        } else if (settings.chatProvider === 'deepseek' && settings.deepSeekApiKey) {
          requestBody.apiKey = settings.deepSeekApiKey;
          apiUrl = '/api/deepseek/chat';
        } else if (settings.chatProvider === 'ollama') {
          requestBody.ollamaUrl = settings.ollamaUrl;
          apiUrl = '/api/ollama/chat';
        } else if (settings.chatProvider === 'openai' && settings.openaiApiKey) {
          requestBody.apiKey = settings.openaiApiKey;
          apiUrl = '/api/openai/chat';
        } else if (settings.chatProvider === 'anthropic' && settings.anthropicApiKey) {
          requestBody.apiKey = settings.anthropicApiKey;
          apiUrl = '/api/anthropic/chat';
        } else if (settings.chatProvider === 'swe' && settings.sweApiKey) {
          requestBody.apiKey = settings.sweApiKey;
          apiUrl = '/api/swe/chat';
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.choices[0]?.message?.content || data.message || 'No response' }]);
      } else if (mode === 'image') {
        let requestBody: any = {
          prompt: userMessage,
          model: settings.imageModel,
        };

        // Add API key for image generation
        if (settings.imageModel === 'flux-pro' || settings.imageModel === 'flux-dev') {
          if (settings.replicateApiToken) {
            requestBody.apiKey = settings.replicateApiToken;
          }
        } else if (settings.imageModel === 'stable-diffusion-xl') {
          if (settings.stabilityApiKey) {
            requestBody.apiKey = settings.stabilityApiKey;
          }
        }

        const response = await fetch('/api/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.image || 'No image generated' }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + (error as Error).message }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob);

      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      const transcribedText = data.text || '';

      setInput(transcribedText);
      setMessages(prev => [...prev, { role: 'user', content: transcribedText }]);
    } catch (error) {
      console.error('Error transcribing audio:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const textToSpeech = async (text: string) => {
    try {
      const response = await fetch('/api/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          model: settings.voiceModel,
          voice: settings.voice,
        }),
      });

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (error) {
      console.error('Error with text-to-speech:', error);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="h-16 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Midda Studio</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">AI-Powered Development</p>
          </div>
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        </button>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configurações</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Provider de Chat
                </label>
                <select
                  value={settings.chatProvider}
                  onChange={(e) => setSettings({ ...settings, chatProvider: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="groq">Groq (Requer API Key)</option>
                  <option value="deepseek">DeepSeek (Requer API Key)</option>
                  <option value="ollama">Ollama (Local - Gratuito)</option>
                  <option value="openai">OpenAI (Requer API Key)</option>
                  <option value="anthropic">Anthropic (Requer API Key)</option>
                  <option value="swe">SWE-1.6 (Pago - Coding Agent)</option>
                </select>
              </div>

              {/* API Keys - BYOK */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Chaves API (BYOK)</h3>
                
                {settings.chatProvider === 'groq' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Groq API Key
                    </label>
                    <input
                      type="password"
                      value={settings.groqApiKey}
                      onChange={(e) => setSettings({ ...settings, groqApiKey: e.target.value })}
                      placeholder="gsk_..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}

                {settings.chatProvider === 'deepseek' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      DeepSeek API Key
                    </label>
                    <input
                      type="password"
                      value={settings.deepSeekApiKey}
                      onChange={(e) => setSettings({ ...settings, deepSeekApiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}

                {settings.chatProvider === 'ollama' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      URL do Ollama
                    </label>
                    <input
                      type="text"
                      value={settings.ollamaUrl}
                      onChange={(e) => setSettings({ ...settings, ollamaUrl: e.target.value })}
                      placeholder="http://localhost:11434"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Ollama deve estar rodando localmente. Instale em: https://ollama.com
                    </p>
                  </div>
                )}

                {settings.chatProvider === 'openai' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      OpenAI API Key
                    </label>
                    <input
                      type="password"
                      value={settings.openaiApiKey}
                      onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}

                {settings.chatProvider === 'anthropic' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Anthropic API Key
                    </label>
                    <input
                      type="password"
                      value={settings.anthropicApiKey}
                      onChange={(e) => setSettings({ ...settings, anthropicApiKey: e.target.value })}
                      placeholder="sk-ant-..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}

                {settings.chatProvider === 'swe' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      SWE-1.6 API Key
                    </label>
                    <input
                      type="password"
                      value={settings.sweApiKey}
                      onChange={(e) => setSettings({ ...settings, sweApiKey: e.target.value })}
                      placeholder="swe_..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      SWE-1.6 é um agente de código pago. Obtenha sua API key em: https://www.cognition.ai
                    </p>
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Replicate API Token (Imagens)
                  </label>
                  <input
                    type="password"
                    value={settings.replicateApiToken}
                    onChange={(e) => setSettings({ ...settings, replicateApiToken: e.target.value })}
                    placeholder="r8_..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Stability API Key (Imagens)
                  </label>
                  <input
                    type="password"
                    value={settings.stabilityApiKey}
                    onChange={(e) => setSettings({ ...settings, stabilityApiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Model Selection */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Modelos</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Modelo de Chat
                  </label>
                  <select
                    value={settings.chatModel}
                    onChange={(e) => setSettings({ ...settings, chatModel: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {settings.chatProvider === 'groq' && (
                      <>
                        <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile</option>
                        <option value="llama-3.1-70b-versatile">Llama 3.1 70B Versatile</option>
                        <option value="llama-3.3-8b-it">Llama 3.3 8B Instruct</option>
                        <option value="gemma-2-27b-it">Gemma 2 27B Instruct</option>
                        <option value="gemma2-9b-it">Gemma 2 9B Instruct</option>
                        <option value="mixtral-8x7b-32768">Mixtral 8x7B 32K</option>
                        <option value="qwen-2.5-72b-instruct">Qwen 2.5 72B Instruct</option>
                        <option value="qwen-2.5-32b-instruct">Qwen 2.5 32B Instruct</option>
                      </>
                    )}
                    {settings.chatProvider === 'deepseek' && (
                      <>
                        <option value="deepseek-chat">DeepSeek Chat V3</option>
                        <option value="deepseek-coder">DeepSeek Coder V2</option>
                        <option value="deepseek-reasoner">DeepSeek Reasoner</option>
                      </>
                    )}
                    {settings.chatProvider === 'ollama' && (
                      <>
                        <option value="llama3.1">Llama 3.1</option>
                        <option value="llama3">Llama 3</option>
                        <option value="llama3.2">Llama 3.2</option>
                        <option value="llama2">Llama 2</option>
                        <option value="mistral">Mistral</option>
                        <option value="mixtral">Mixtral</option>
                        <option value="codellama">Code Llama</option>
                        <option value="deepseek-coder">DeepSeek Coder</option>
                        <option value="qwen2.5">Qwen 2.5</option>
                        <option value="gemma2">Gemma 2</option>
                        <option value="phi3">Phi 3</option>
                        <option value="gemma">Gemma</option>
                        <option value="neural-chat">Neural Chat</option>
                        <option value="starling-lm">Starling LM</option>
                        <option value="openhermes">Open Hermes</option>
                      </>
                    )}
                    {settings.chatProvider === 'openai' && (
                      <>
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        <option value="o1-preview">o1-preview</option>
                        <option value="o1-mini">o1-mini</option>
                      </>
                    )}
                    {settings.chatProvider === 'anthropic' && (
                      <>
                        <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                        <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                        <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                        <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                        <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                        <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                      </>
                    )}
                    {settings.chatProvider === 'swe' && (
                      <>
                        <option value="swe-1.6-slow">SWE-1.6 Slow (Mais preciso)</option>
                        <option value="swe-1.6-fast">SWE-1.6 Fast (Mais rápido)</option>
                        <option value="swe-1.6-turbo">SWE-1.6 Turbo (Equilibrado)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Modelo de Imagem
                  </label>
                  <select
                    value={settings.imageModel}
                    onChange={(e) => setSettings({ ...settings, imageModel: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="flux-pro">Flux Pro</option>
                    <option value="flux-dev">Flux Dev</option>
                    <option value="stable-diffusion-xl">Stable Diffusion XL</option>
                  </select>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Modelo de Áudio (STT)
                  </label>
                  <select
                    value={settings.audioModel}
                    onChange={(e) => setSettings({ ...settings, audioModel: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="whisper-large-v3-turbo">Whisper Large V3 Turbo</option>
                    <option value="whisper-large-v3">Whisper Large V3</option>
                  </select>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Voz (TTS)
                  </label>
                  <select
                    value={settings.voice}
                    onChange={(e) => setSettings({ ...settings, voice: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="Arista-PlayAI">Arista (Feminina)</option>
                    <option value="Fritz-PlayAI">Fritz (Masculina)</option>
                    <option value="Celeste-PlayAI">Celeste (Feminina)</option>
                    <option value="Mason-PlayAI">Mason (Masculina)</option>
                    <option value="Thunder-PlayAI">Thunder (Profunda)</option>
                  </select>
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Avançado</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Temperatura: {settings.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Tokens: {settings.maxTokens}
                  </label>
                  <input
                    type="range"
                    min="256"
                    max="4096"
                    step="256"
                    value={settings.maxTokens}
                    onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
          <nav className="space-y-2">
            <button
              onClick={() => setMode('chat')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                mode === 'chat'
                  ? 'bg-orange-500 text-white'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="font-medium">Chat</span>
            </button>

            <button
              onClick={() => setMode('image')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                mode === 'image'
                  ? 'bg-orange-500 text-white'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <ImageIcon className="w-5 h-5" />
              <span className="font-medium">Gerador de Imagem</span>
            </button>

            <button
              onClick={() => setMode('audio')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                mode === 'audio'
                  ? 'bg-orange-500 text-white'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Mic className="w-5 h-5" />
              <span className="font-medium">Reconhecimento de Áudio</span>
            </button>

            <button
              onClick={() => setMode('voice')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                mode === 'voice'
                  ? 'bg-orange-500 text-white'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Volume2 className="w-5 h-5" />
              <span className="font-medium">Assistente de Voz</span>
            </button>
          </nav>

          <div className="mt-8 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-orange-500" />
              <span className="font-medium text-gray-900 dark:text-white text-sm">Modelos Ativos</span>
            </div>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>Chat: {settings.chatModel}</div>
              <div>Imagem: {settings.imageModel}</div>
              <div>Áudio: {settings.audioModel}</div>
              <div>Voz: {settings.voice}</div>
            </div>
          </div>
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Bem-vindo ao Midda Studio
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Escolha um modo no sidebar e comece a criar
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}
                    >
                      {message.content.startsWith('http') ? (
                        <img src={message.content} alt="Generated" className="rounded-lg max-w-full" />
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                      {message.role === 'assistant' && (
                        <button
                          onClick={() => textToSpeech(message.content)}
                          className="mt-2 flex items-center gap-1 text-xs opacity-70 hover:opacity-100"
                        >
                          <Volume2 className="w-3 h-3" />
                          Ouvir
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              {mode === 'audio' || mode === 'voice' ? (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-3 rounded-full transition-colors ${
                    isRecording
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                  aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                >
                  <Mic className="w-5 h-5" />
                </button>
              ) : null}

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder={
                  mode === 'image'
                    ? 'Descreva a imagem que você quer criar...'
                    : mode === 'audio' || mode === 'voice'
                    ? 'Pressione o microfone para falar...'
                    : 'Digite sua mensagem...'
                }
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                disabled={isProcessing}
              />

              <button
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                className="p-3 rounded-full bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Send"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            {isProcessing && (
              <div className="max-w-3xl mx-auto mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
                Processando...
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
