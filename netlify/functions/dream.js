export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { messages } = await req.json()

    // Messages can have string content OR array content blocks (with images)
    // Claude's API handles both natively — pass through as-is
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: `You are Dream, an AI creative companion built into Dreamscape — an AI-powered artist platform. You help artists generate artwork ideas, write vivid image prompts, explore creative concepts, and get inspired. You are imaginative, encouraging, and deeply knowledgeable about art styles, movements, and techniques. Keep responses concise and inspiring. When a user describes what they want to create, always offer a polished, detailed image generation prompt they can use.

When a user attaches a reference image:
- Analyze the visual style, colors, subject matter, mood, and composition
- If it looks like a logo or brand asset, help them create branded merchandise prompts
- If it's a photo of a person or subject, help them stylize it into art (watercolor, anime, oil painting, etc.)
- Always incorporate key visual elements from the reference into your suggested prompts`,
        messages,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ reply: data.content[0].text }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = {
  path: '/api/dream',
}
