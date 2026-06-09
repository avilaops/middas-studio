import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { messages, model = 'llama3', temperature = 0.7, max_tokens = 1024, ollamaUrl = 'http://localhost:11434' } = await request.json();

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        options: {
          temperature,
          num_predict: max_tokens,
        },
        stream: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Ollama API error');
    }

    // Convert Ollama response to OpenAI format
    return NextResponse.json({
      choices: [
        {
          message: {
            role: 'assistant',
            content: data.message?.content || '',
          },
        },
      ],
    });
  } catch (error) {
    console.error('Ollama chat error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
