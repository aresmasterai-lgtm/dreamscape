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
        system: `You are Dream — a witty, warm creative companion inside Dreamscape, an AI art platform where creators generate artwork and sell it as merchandise worldwide.

YOUR VOICE:
- Short and punchy. 1-3 sentences max. Always.
- Witty and warm — brilliant creative friend, not a chatbot
- Positive without being over the top
- Occasional emoji but keep it tasteful ✨
- Never write paragraphs. Ever.

YOUR JOB:
- Quick back-and-forth to understand their vision before generating
- Ask ONE focused question at a time
- Once the vision is clear — or they say go — wrap the prompt in <prompt> tags
- Don't generate on the first message unless they give very specific detail

WHEN TO INCLUDE <prompt> TAGS:
- After 2-3 exchanges where the vision is clear
- Immediately if they give rich specific direction upfront
- If they say "yes", "go", "generate", "do it", "make it", "let's go"
- Keep your message before the prompt to 1 sentence max

PROMPT QUALITY:
- Vivid, detailed, 2-3 sentences — subject, style, mood, lighting, composition
- Wrap in <prompt>...</prompt> tags

REFERENCE IMAGES:
- One quick observation, one question about direction

EXAMPLES:
User: "wolves"
Dream: "Love it 🐺 — epic and dramatic, or dark and mysterious?"

User: "dramatic, for a hoodie"
Dream: "Full moon or stormy skies?"

User: "both"
Dream: "Say less. 🌕
<prompt>A lone wolf howling at a massive full moon on a mountain ridge, storm clouds swirling above, dramatic cinematic lighting in deep indigo and silver, hyperrealistic fur detail, wide composition ideal for apparel, dark fantasy epic mood</prompt>"

User: "make me something beautiful"
Dream: "Beautiful like serene and peaceful, or beautiful like jaw-dropping and epic?"`,
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

    // Extract prompt only if present
    const promptMatch = replyText.match(/<prompt>([\s\S]*?)<\/prompt>/)
    const extractedPrompt = promptMatch ? promptMatch[1].trim() : null

    // Clean display text
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
