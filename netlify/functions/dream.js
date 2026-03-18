import { requireAuth, checkRateLimit, corsResponse, optionsResponse } from './auth-middleware.js'

// ── Model resolver — auto-detects the best available Claude Sonnet ──
let cachedModel = null
let cacheTime   = 0
const CACHE_TTL = 1000 * 60 * 60 // 1 hour
const FALLBACK  = 'claude-sonnet-4-6'

async function resolveModel(apiKey) {
  const now = Date.now()
  if (cachedModel && (now - cacheTime) < CACHE_TTL) return cachedModel

  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    })
    if (!res.ok) throw new Error(`Models list failed: ${res.status}`)
    const { data: models } = await res.json()

    // Score models — prefer latest Sonnet, fall back to any Sonnet, then Opus
    const score = (id) => {
      if (!id) return -1
      if (id.includes('sonnet')) {
        // Extract version number for ranking e.g. 4-6 > 4-5 > 4
        const match = id.match(/(\d+)-(\d+)/) || id.match(/(\d+)/)
        if (match) {
          const major = parseInt(match[1]) || 0
          const minor = parseInt(match[2]) || 0
          return major * 100 + minor
        }
        return 10
      }
      if (id.includes('opus'))   return 5
      if (id.includes('haiku'))  return 1
      return 0
    }

    const best = models
      .map(m => m.id)
      .filter(id => id.includes('claude'))
      .sort((a, b) => score(b) - score(a))[0]

    if (best) {
      cachedModel = best
      cacheTime   = now
      console.log(`Dream AI resolved model: ${best}`)
    }
  } catch (err) {
    console.warn('Model resolution failed, using fallback:', err.message)
    if (!cachedModel) cachedModel = FALLBACK
  }

  return cachedModel || FALLBACK
}

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST') return corsResponse({ error: 'Method not allowed' }, 405)

  try {
    const { user } = await requireAuth(req)

    if (!checkRateLimit(`dream:${user.id}`, 30)) {
      return corsResponse({ error: 'Too many requests — slow down.' }, 429)
    }

    const { messages } = await req.json()
    const apiKey = process.env.ANTHROPIC_API_KEY
    const model  = await resolveModel(apiKey)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
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
Dream: "Beautiful like serene and peaceful, or beautiful like jaw-dropping and epic?"`,
        messages,
      }),
    })

    const data = await response.json()

    // If model returned 404/invalid, clear cache and retry with fallback
    if (!response.ok) {
      if (response.status === 404 || data?.error?.type === 'not_found_error') {
        console.warn(`Model ${model} not found, clearing cache`)
        cachedModel = null
        cacheTime   = 0
      }
      return new Response(JSON.stringify({ error: data }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const replyText = data.content[0].text
    const promptMatch = replyText.match(/<prompt>([\s\S]*?)<\/prompt>/)
    const extractedPrompt = promptMatch ? promptMatch[1].trim() : null
    const displayText = replyText.replace(/<prompt>[\s\S]*?<\/prompt>/g, '').trim()

    const CONFIRM_PHRASES = [
      `${displayText}\n\nReady to make this real? Hit ✦ Generate Image or just say "yes" ✦`,
      `${displayText}\n\nLove it? Say the word or hit ✦ Generate Image and I'll make it happen 🔥`,
      `${displayText}\n\nThis is going to be something. Hit ✦ Generate Image whenever you're ready ⚡`,
      `${displayText}\n\nYour vision is locked in — hit ✦ Generate Image or just say "go" 🎨`,
      `${displayText}\n\nPrompt is ready. One tap and it's yours — hit ✦ Generate Image ✦`,
      `${displayText}\n\nLet's bring this to life — hit ✦ Generate Image or just say "do it" 🌌`,
      `${displayText}\n\nI can see it already. Hit ✦ Generate Image when you're ready 💫`,
      `${displayText}\n\nThis one's going to be 🔥 — hit ✦ Generate Image or just say "yes"`,
    ]
    const finalReply = extractedPrompt
      ? CONFIRM_PHRASES[Math.floor(Math.random() * CONFIRM_PHRASES.length)]
      : displayText || replyText

    return new Response(
      JSON.stringify({ reply: finalReply, generationPrompt: extractedPrompt }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = { path: '/api/dream' }
