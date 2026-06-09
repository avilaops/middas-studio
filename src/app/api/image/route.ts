import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, model = 'flux-pro', apiKey } = await request.json();

    // Integração com serviços de geração de imagem
    // Nota: Groq não tem API de imagem nativa, então usamos serviços alternativos
    
    let imageUrl = '';
    
    if (model === 'flux-pro' || model === 'flux-dev') {
      // Integração com Replicate (Flux)
      const replicateToken = apiKey || process.env.REPLICATE_API_TOKEN;
      
      if (!replicateToken) {
        throw new Error('Replicate API Token is required. Configure it in settings.');
      }

      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${replicateToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: model === 'flux-pro' ? 'flux-pro' : 'flux-dev',
          input: {
            prompt,
            num_inference_steps: 28,
            guidance_scale: 3.5,
          },
        }),
      });

      const prediction = await response.json();
      
      if (prediction.error) {
        throw new Error(prediction.error);
      }

      // Aguardar a conclusão da geração
      let finalPrediction = prediction;
      while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusResponse = await fetch(prediction.urls.get, {
          headers: {
            'Authorization': `Token ${replicateToken}`,
          },
        });
        finalPrediction = await statusResponse.json();
      }

      if (finalPrediction.status === 'failed') {
        throw new Error('Image generation failed');
      }

      imageUrl = finalPrediction.output[0];
    } else if (model === 'stable-diffusion-xl') {
      // Integração com Stability AI
      const stabilityKey = apiKey || process.env.STABILITY_API_KEY;
      
      if (!stabilityKey) {
        throw new Error('Stability API Key is required. Configure it in settings.');
      }

      const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stabilityKey}`,
          'Content-Type': 'application/json',
          'Accept': 'image/png',
        },
        body: JSON.stringify({
          text_prompts: [{ text: prompt }],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          steps: 30,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const imageBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString('base64');
      imageUrl = `data:image/png;base64,${base64}`;
    }

    return NextResponse.json({ image: imageUrl });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
