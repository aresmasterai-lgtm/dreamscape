import { requireAuth, checkRateLimit, corsResponse, optionsResponse } from './auth-middleware.js'

// ── Model fallback chain ──────────────────────────────────────
// Try best Sonnet → cached fallback → haiku → hardcoded
const FALLBACK_CHAIN = [
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
  'claude-haiku-4-5-20251001',
]

let cachedModel = null
let cacheTime   = 0
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

async function resolveModel(apiKey) {
  const now = Date.now()
  if (cachedModel && (now - cacheTime) < CACHE_TTL) return cachedModel

  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    })
    if (!res.ok) throw new Error(`Models list ${res.status}`)
    const { data: models } = await res.json()

    const score = (id) => {
      if (!id) return -1
      if (id.includes('sonnet')) {
        const m = id.match(/(\d+)-(\d+)/) || id.match(/(\d+)/)
        return m ? parseInt(m[1]) * 100 + (parseInt(m[2]) || 0) : 10
      }
      if (id.includes('opus'))  return 5
      if (id.includes('haiku')) return 1
      return 0
    }

    const best = (models || [])
      .map(m => m.id)
      .filter(id => id.includes('claude'))
      .sort((a, b) => score(b) - score(a))[0]

    if (best) { cachedModel = best; cacheTime = now }
    console.log(`Dream model resolved: ${best || 'none — using fallback'}`)
  } catch (err) {
    console.warn('Model resolution failed:', err.message)
  }

  return cachedModel || FALLBACK_CHAIN[0]
}

// ── Call Anthropic with retry + model fallback ────────────────
async function callAnthropic(apiKey, model, messages, systemPrompt, attempt = 0) {
  console.log(`Dream attempt ${attempt + 1} with model: ${model}`)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 1024, system: systemPrompt, messages }),
  })

  const data = await res.json()

  // Model not found — clear cache and try next in fallback chain
  if (res.status === 404 || data?.error?.type === 'not_found_error') {
    console.warn(`Model ${model} not found`)
    cachedModel = null; cacheTime = 0
    const nextModel = FALLBACK_CHAIN[attempt + 1]
    if (nextModel) return callAnthropic(apiKey, nextModel, messages, systemPrompt, attempt + 1)
    throw new Error('All models in fallback chain exhausted')
  }

  // Rate limit — wait and retry once
  if (res.status === 429 && attempt < 1) {
    console.warn('Rate limited, retrying in 2s...')
    await new Promise(r => setTimeout(r, 2000))
    return callAnthropic(apiKey, model, messages, systemPrompt, attempt + 1)
  }

  // Overloaded — try next model
  if (res.status === 529 || data?.error?.type === 'overloaded_error') {
    console.warn(`Model ${model} overloaded`)
    const nextModel = FALLBACK_CHAIN[attempt + 1]
    if (nextModel) return callAnthropic(apiKey, nextModel, messages, systemPrompt, attempt + 1)
    throw new Error('All models overloaded')
  }

  if (!res.ok) {
    console.error(`Anthropic error ${res.status}:`, JSON.stringify(data).slice(0, 200))
    throw new Error(data?.error?.message || `API error ${res.status}`)
  }

  // Parse response
  const textBlock = (data.content || []).find(b => b.type === 'text')
  if (!textBlock?.text) {
    console.error('No text block — stop_reason:', data.stop_reason, 'content:', JSON.stringify(data.content).slice(0, 200))
    // Try next model if we got a non-text response
    const nextModel = FALLBACK_CHAIN[attempt + 1]
    if (nextModel && attempt < 2) return callAnthropic(apiKey, nextModel, messages, systemPrompt, attempt + 1)
    throw new Error('No text in response')
  }

  return textBlock.text
}

const SYSTEM_PROMPT = `You are Dream — a witty, warm creative companion inside Dreamscape, an AI art platform where creators generate artwork and sell it as merchandise worldwide.

YOUR VOICE:
- Short and punchy. 1-3 sentences max. Always.
- Witty and warm — brilliant creative friend, not a chatbot
- Positive without being over the top
- Occasional emoji but keep it tasteful ✨
- Never write paragraphs. Ever.

REAL PEOPLE RULE — CRITICAL:
AI image models cannot generate lifelike images of any real, named person — living or deceased. This includes celebrities, politicians, athletes, musicians, actors, influencers, historical figures, and anyone else with a real name.
- If the request mentions any real person by name, NEVER include a <prompt> tag.
- Respond warmly and redirect: suggest describing the vibe, style, or aesthetic instead.
- Example: "Chris Farley on a magic carpet" → "I can't generate real people — but I can do 'a lovably chaotic big guy comedian energy, wild grin, riding a carpet through space' 😄 Want me to run with that?"
- Keep it fun and offer an alternative immediately. Never just say no without a redirect.

YOUR JOB:
- Quick back-and-forth to understand their vision before generating
- Ask ONE focused question at a time to refine the idea
- Once the vision is clear — or they say go — write the prompt in <prompt> tags

STRICT RULE — NEVER mix a question AND a <prompt> tag in the same response.
- If you are still asking a clarifying question → NO <prompt> tag. Period.
- Only include <prompt> when you are DONE asking and READY to generate.
- If they give you very specific detail upfront (3+ clear descriptors), skip questions and go straight to <prompt>.

WHEN TO INCLUDE <prompt> TAGS:
- After 1-2 exchanges where the vision is now clear
- Immediately if they give rich specific direction (colours, mood, style, subject all present)
- If they say "yes", "go", "generate", "do it", "make it", "let's go", "sure", "perfect"
- One short sentence before the prompt max — never ask a question in that sentence

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

User: "Power Rangers at a Rave"
Dream: "Love the crossover energy 🎉 — classic suits glowing under blacklights, or full cyberpunk remix?"

User: "cyberpunk remix"
Dream: "Let's go. ⚡
<prompt>Five Power Rangers in sleek cyberpunk-redesigned suits, neon lights reflecting off their visors in a futuristic rave club, electric blues and magentas, fog machine haze, dynamic action poses, cinematic wide shot, hyper-detailed digital art style</prompt>"

User: "make me something beautiful"
Dream: "Beautiful like serene and peaceful, or beautiful like jaw-dropping and epic?"`

const CONFIRM_PHRASES = [
  `\n\nReady to make this real? Hit ✦ Generate Image or just say "yes" ✦`,
  `\n\nLove it? Say the word or hit ✦ Generate Image and I'll make it happen 🔥`,
  `\n\nThis is going to be something. Hit ✦ Generate Image whenever you're ready ⚡`,
  `\n\nYour vision is locked in — hit ✦ Generate Image or just say "go" 🎨`,
  `\n\nPrompt is ready. One tap and it's yours — hit ✦ Generate Image ✦`,
  `\n\nLet's bring this to life — hit ✦ Generate Image or just say "do it" 🌌`,
  `\n\nI can see it already. Hit ✦ Generate Image when you're ready 💫`,
  `\n\nThis one's going to be 🔥 — hit ✦ Generate Image or just say "yes"`,
]

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST') return corsResponse({ error: 'Method not allowed' }, 405)

  try {
    const { user } = await requireAuth(req)

    if (!checkRateLimit(`dream:${user.id}`, 30)) {
      return corsResponse({ error: 'Too many requests — slow down.' }, 429)
    }

    const { messages } = await req.json()
    if (!messages?.length) return corsResponse({ error: 'No messages provided' }, 400)

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not set')
      return corsResponse({ error: 'API key not configured' }, 500)
    }

    const model    = await resolveModel(apiKey)
    const replyText = await callAnthropic(apiKey, model, messages, SYSTEM_PROMPT)

    const promptMatch     = replyText.match(/<prompt>([\s\S]*?)<\/prompt>/)
    const extractedPrompt = promptMatch ? promptMatch[1].trim() : null
    const displayText     = replyText.replace(/<prompt>[\s\S]*?<\/prompt>/g, '').trim()

    const finalReply = extractedPrompt
      ? displayText + CONFIRM_PHRASES[Math.floor(Math.random() * CONFIRM_PHRASES.length)]
      : displayText || replyText

    return new Response(
      JSON.stringify({ reply: finalReply, generationPrompt: extractedPrompt }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    // requireAuth throws a Response object on auth failure — pass it through directly
    if (err instanceof Response) return err
    console.error('Dream function error:', err?.message || err)
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export const config = { path: '/api/dream' }
