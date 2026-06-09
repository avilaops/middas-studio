import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { messages, model = 'swe-1.6-slow', temperature = 0.7, max_tokens = 4096, apiKey } = await request.json();

    // SWE-1.6 API endpoint (Cognition)
    const response = await fetch('https://api.cognition.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages,
        model,
        temperature,
        max_tokens,
        stream: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'SWE-1.6 API error');
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('SWE-1.6 chat error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
