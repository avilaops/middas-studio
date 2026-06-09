import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { messages, model = 'claude-3-5-sonnet-20241022', temperature = 0.7, max_tokens = 1024, apiKey } = await request.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens,
        temperature,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Anthropic API error');
    }

    // Convert Anthropic response to OpenAI format
    return NextResponse.json({
      choices: [
        {
          message: {
            role: 'assistant',
            content: data.content[0]?.text || '',
          },
        },
      ],
    });
  } catch (error) {
    console.error('Anthropic chat error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
