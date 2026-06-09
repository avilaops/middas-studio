#!/usr/bin/env node

import { createInterface } from 'readline';
import Groq from 'groq-sdk';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function askQuestion(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('🤖 Midda CLI - Midda Studio Code');
  console.log('=====================================\n');

  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY não encontrada. Defina a variável de ambiente.');
    process.exit(1);
  }

  console.log('Escolha uma opção:');
  console.log('1. Chat com IA');
  console.log('2. Transcrição de áudio');
  console.log('3. Texto para fala');
  console.log('4. Sair\n');

  const choice = await askQuestion('Opção: ');

  switch (choice.trim()) {
    case '1':
      await chatMode();
      break;
    case '2':
      await transcribeMode();
      break;
    case '3':
      await ttsMode();
      break;
    case '4':
      console.log('👋 Até logo!');
      rl.close();
      process.exit(0);
    default:
      console.log('❌ Opção inválida');
      rl.close();
      process.exit(1);
  }
}

async function chatMode() {
  console.log('\n💬 Chat Mode (digite "exit" para sair)\n');
  
  const model = await askQuestion('Modelo (default: llama-3.3-70b-versatile): ') || 'llama-3.3-70b-versatile';
  const systemPrompt = await askQuestion('System prompt (opcional, pressione Enter para pular): ') || 'You are a helpful AI assistant.';
  
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  while (true) {
    const userMessage = await askQuestion('Você: ');
    
    if (userMessage.toLowerCase() === 'exit') {
      console.log('\n👋 Saindo do chat...');
      rl.close();
      process.exit(0);
    }

    messages.push({ role: 'user', content: userMessage });

    try {
      console.log('🤖 Pensando...');
      const completion = await groq.chat.completions.create({
        messages,
        model,
        temperature: 0.7,
        max_tokens: 1024,
        stream: true
      });

      let assistantMessage = '';
      process.stdout.write('Assistente: ');
      
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || '';
        process.stdout.write(content);
        assistantMessage += content;
      }
      
      console.log('\n');
      messages.push({ role: 'assistant', content: assistantMessage });
    } catch (error) {
      console.error('❌ Erro:', error.message);
    }
  }
}

async function transcribeMode() {
  console.log('\n🎙️ Transcribe Mode\n');
  console.log('Para usar este modo, você precisa fornecer o caminho de um arquivo de áudio.');
  
  const filePath = await askQuestion('Caminho do arquivo de áudio: ');
  
  try {
    console.log('📝 Transcrevendo...');
    const transcription = await groq.audio.transcriptions.create({
      file: require('fs').createReadStream(filePath),
      model: 'whisper-large-v3-turbo'
    });
    
    console.log('\nTranscrição:');
    console.log(transcription.text);
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
  
  rl.close();
  process.exit(0);
}

async function ttsMode() {
  console.log('\n🔊 Text-to-Speech Mode\n');
  
  const text = await askQuestion('Texto para converter: ');
  const voice = await askQuestion('Voz (default: Arista-PlayAI): ') || 'Arista-PlayAI';
  
  try {
    console.log('🔊 Gerando áudio...');
    const speech = await groq.audio.speech.create({
      model: 'playai-tts',
      voice,
      input: text
    });
    
    const buffer = Buffer.from(await speech.arrayBuffer());
    const outputPath = 'midda-tts-output.mp3';
    require('fs').writeFileSync(outputPath, buffer);
    
    console.log(`✅ Áudio salvo em: ${outputPath}`);
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
  
  rl.close();
  process.exit(0);
}

main().catch(console.error);
