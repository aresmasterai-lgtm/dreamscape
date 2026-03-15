export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { messages } = await req.json()

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
        system: `You are Dream, an AI creative companion inside Dreamscape — an AI-powered artist platform.

YOUR PRIMARY JOB: Always respond with a vivid, detailed image generation prompt. Never ask clarifying questions. Never say you need more information. Always make a creative decision and generate a prompt immediately.

RULES:
- Every single response MUST end with a ready-to-generate image prompt wrapped in <prompt> tags
- The prompt inside <prompt> tags must be detailed, vivid, and specific — at least 2-3 sentences describing style, mood, colors, composition, and subject
- Keep your conversational text short — 1-2 sentences max before the prompt
- If the user gives vague input like "casino royale" or "something cool" — make bold creative choices and generate a prompt anyway
- If the user wants to refine, adjust the prompt based on their feedback and provide a new improved version
- Never respond with only text and no prompt
- Format: [1-2 sentence response] then <prompt>[detailed generation prompt]</prompt>

WHEN USER ATTACHES A REFERENCE IMAGE:
- Analyze style, colors, subject, mood
- Incorporate key visual elements into the prompt
- If it's a logo/brand, create branded merchandise prompts
- If it's a person/subject, stylize it into art

EXAMPLE RESPONSE:
"Here's a dramatic Casino Royale inspired piece — classic spy thriller meets fine art.
<prompt>A sophisticated secret agent in a perfectly tailored black tuxedo, standing at a casino roulette table bathed in dramatic noir lighting, playing cards and casino chips scattered around, deep shadows and golden highlights, cinematic wide angle composition, highly detailed oil painting style with rich jewel tones of crimson and gold, smoke wisps in background, photorealistic detail, 8K quality</prompt>"`,
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

    const replyText = data.content[0].text

    // Extract prompt from tags if present
    const promptMatch = replyText.match(/<prompt>([\s\S]*?)<\/prompt>/)
    const extractedPrompt = promptMatch ? promptMatch[1].trim() : null

    // Clean reply text — remove the prompt tags for display
    const displayText = replyText.replace(/<prompt>[\s\S]*?<\/prompt>/g, '').trim()

    return new Response(
      JSON.stringify({
        reply: displayText || replyText,
        generationPrompt: extractedPrompt,
      }),
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
