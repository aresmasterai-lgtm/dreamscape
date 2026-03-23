import { requireAuth, checkRateLimit, corsResponse, optionsResponse } from './auth-middleware.js'
import { createClient } from '@supabase/supabase-js'

// ── Model resolution cache ────────────────────────────────────
let cachedGeminiModel = null
let cachedImagenModel = null
let cacheTime = 0
const CACHE_TTL = 1000 * 60 * 60

// Known-good fallbacks — used immediately if API resolution fails or returns nothing
const GEMINI_FALLBACK = 'gemini-2.0-flash-exp'
const IMAGEN_FALLBACK  = 'imagen-3.0-generate-001'

async function resolveModels(apiKey) {
  const now = Date.now()
  // Cache hit — either model being set is sufficient
  if ((cachedGeminiModel || cachedImagenModel) && (now - cacheTime) < CACHE_TTL) {
    return {
      gemini: cachedGeminiModel || GEMINI_FALLBACK,
      imagen: cachedImagenModel || IMAGEN_FALLBACK,
    }
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`,
      { headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) throw new Error(`ListModels HTTP ${res.status}`)
    const data = await res.json()
    const models = data.models || []

    // Gemini image generation models — match known naming patterns
    const geminiCandidates = models.filter(m => {
      const name = (m.name || '').toLowerCase()
      const methods = m.supportedGenerationMethods || []
      const hasGenerate = methods.includes('generateContent')
      const isImageModel = name.includes('image') || name.includes('flash-exp') || name.includes('2.0-flash')
      return hasGenerate && isImageModel
    }).map(m => m.name.replace('models/', ''))

    const geminiScore = (n) => {
      if (n.includes('2.5')) return 5
      if (n.includes('2.0')) return 4
      if (n.includes('3-pro')) return 3
      if (n.includes('3.1')) return 2
      if (n.includes('3')) return 1
      return 0
    }
    geminiCandidates.sort((a, b) => geminiScore(b) - geminiScore(a))

    // Imagen models
    const imagenCandidates = models.filter(m => {
      const name = (m.name || '').toLowerCase()
      const methods = m.supportedGenerationMethods || []
      return (methods.includes('predict') || methods.includes('generateImages')) && name.includes('imagen')
    }).map(m => m.name.replace('models/', ''))
    imagenCandidates.sort((a, b) => {
      if (a.includes('4') && !b.includes('4')) return -1
      if (b.includes('4') && !a.includes('4')) return 1
      if (a.includes('ultra') && !b.includes('ultra')) return -1
      if (b.includes('ultra') && !a.includes('ultra')) return 1
      return b.localeCompare(a)
    })

    cachedGeminiModel = geminiCandidates[0] || GEMINI_FALLBACK
    cachedImagenModel = imagenCandidates[0] || IMAGEN_FALLBACK
    cacheTime = now
    console.log(`[generate-image] Resolved models: gemini=${cachedGeminiModel} imagen=${cachedImagenModel}`)
  } catch (err) {
    console.warn('[generate-image] ListModels failed, using hardcoded fallbacks:', err.message)
    if (!cachedGeminiModel) cachedGeminiModel = GEMINI_FALLBACK
    if (!cachedImagenModel) cachedImagenModel = IMAGEN_FALLBACK
    cacheTime = now // cache the fallbacks too — don't retry every request
  }
  return { gemini: cachedGeminiModel, imagen: cachedImagenModel }
}

function buildParts(prompt, referenceImage) {
  if (referenceImage) {
    const match = referenceImage.match(/^data:(image\/[^;]+);base64,(.+)$/)
    if (match) return [
      { inline_data: { mime_type: match[1], data: match[2] } },
      { text: `Using this reference image for style inspiration, generate: ${prompt}` },
    ]
  }
  return [{ text: `Generate a high quality artwork image: ${prompt}` }]
}

async function tryGemini(model, prompt, referenceImage, apiKey, sizeConfig = null) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: buildParts(prompt, referenceImage) }],
        generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            ...(sizeConfig ? { imagenConfig: { aspectRatio: sizeConfig.width > sizeConfig.height ? 'LANDSCAPE' : sizeConfig.width < sizeConfig.height ? 'PORTRAIT' : 'SQUARE' } } : {}),
          },
      }),
    }
  )
  const data = await res.json()
  const errMsg = data.error?.message || ''

  // Model not found — clear cache and retry
  if (data.error?.code === 404 || errMsg.includes('not found') || errMsg.includes('not supported')) {
    cachedGeminiModel = null; cacheTime = 0
    return null
  }

  // API-level error — check for content policy signals
  if (data.error) {
    const isPolicy = data.error.code === 400 ||
      errMsg.toLowerCase().includes('safety') ||
      errMsg.toLowerCase().includes('policy') ||
      errMsg.toLowerCase().includes('person') ||
      errMsg.toLowerCase().includes('harmful')
    if (isPolicy) throw Object.assign(new Error(errMsg || 'Content policy'), { errorType: 'content_policy' })
    throw new Error(errMsg)
  }

  // Candidate-level safety block — Gemini returns finishReason SAFETY with no image part
  const candidate = data.candidates?.[0]
  const finishReason = candidate?.finishReason || ''
  if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT' || finishReason === 'RECITATION') {
    throw Object.assign(new Error(`Blocked: ${finishReason}`), { errorType: 'content_policy' })
  }

  // promptFeedback block (pre-generation safety check)
  const blockReason = data.promptFeedback?.blockReason
  if (blockReason) {
    throw Object.assign(new Error(`Prompt blocked: ${blockReason}`), { errorType: 'content_policy' })
  }

  return (candidate?.content?.parts || []).find(p => p.inlineData) || null
}

async function tryImagen(model, prompt, apiKey, sizeConfig = null) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            ...(sizeConfig && sizeConfig.width !== sizeConfig.height ? {
              aspectRatio: sizeConfig.width > sizeConfig.height ? '16:9' : '9:16'
            } : {}),
          }
        }),
    }
  )
  const data = await res.json()
  if (data.error?.code === 404) { cachedImagenModel = null; cacheTime = 0; return null }
  if (data.error) {
    const msg = data.error.message || ''
    if (msg.toLowerCase().includes('safety') || msg.toLowerCase().includes('policy') || msg.toLowerCase().includes('person') || msg.toLowerCase().includes('public figure') || data.error.code === 400) {
      throw Object.assign(new Error(msg), { errorType: 'content_policy' })
    }
    throw new Error(msg)
  }
  const p = data.predictions?.[0]
  return p?.bytesBase64Encoded ? { imageData: p.bytesBase64Encoded, mimeType: p.mimeType || 'image/png' } : null
}

// ── DALL-E 3 fallback ────────────────────────────────────────
async function tryDalle(prompt, apiKey, sizeConfig = null) {
  // Map to DALL-E supported sizes
  const size = !sizeConfig || (sizeConfig.width === sizeConfig.height) ? '1024x1024'
    : sizeConfig.width > sizeConfig.height ? '1792x1024'
    : '1024x1792'

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 4000),
      n: 1,
      size,
      response_format: 'b64_json',
      quality: 'standard',
    }),
  })

  const data = await res.json()

  if (data.error) {
    console.warn('DALL-E error:', data.error.message)
    if (data.error.code === 'content_policy_violation') {
      throw Object.assign(new Error(data.error.message), { errorType: 'content_policy' })
    }
    throw new Error(data.error.message)
  }

  const b64 = data.data?.[0]?.b64_json
  if (!b64) return null
  console.log('DALL-E 3 generated successfully')
  return { imageData: b64, mimeType: 'image/png' }
}

// Server-side generation limit check
async function checkServerLimit(userId, tier, supabase) {
  if (tier === 'studio') return { allowed: true }
  
  const LIMITS = { free: 10, starter: 50, pro: 200, business: 100 }
  const limit = LIMITS[tier] ?? 10

  const startOfMonth = new Date()
  startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('artwork')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())

  return { allowed: (count || 0) < limit, used: count || 0, limit }
}

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    // ── Auth check ─────────────────────────────────────────────
    const { user, profile, supabase } = await requireAuth(req)

    // ── Rate limit: max 10 requests/min per user ───────────────
    if (!checkRateLimit(`gen:${user.id}`, 10)) {
      return corsResponse({ error: 'Too many requests — slow down.' }, 429)
    }

    // ── Server-side generation limit ───────────────────────────
    const tier = profile?.subscription_tier || 'free'
    const limitCheck = await checkServerLimit(user.id, tier, supabase)
    if (!limitCheck.allowed) {
      return corsResponse({
        error: `You've reached your ${limitCheck.limit} generation limit for this month on the ${tier} plan.`,
        limitReached: true,
      }, 403)
    }

    const { prompt, referenceImage, aspectRatio } = await req.json()
    if (!prompt) return corsResponse({ error: 'Prompt is required' }, 400)

    const apiKey = process.env.GEMINI_API_KEY
    const { gemini, imagen } = await resolveModels(apiKey)

    // Map aspect ratio to Gemini config
    const RATIO_MAP = {
      square:    { width: 1024, height: 1024 },
      portrait:  { width: 896,  height: 1152 },
      landscape: { width: 1152, height: 896  },
      wide:      { width: 1344, height: 768  },
    }
    const sizeConfig = RATIO_MAP[aspectRatio] || RATIO_MAP.square

    // Strategy 1: Gemini — try up to 3 times with progressively simpler prompts
    if (gemini) {
      const attempts = [
        { p: prompt,                                             ref: referenceImage },
        { p: `Illustration: ${prompt.slice(0, 300)}`,           ref: referenceImage },
        { p: `Colorful digital art, fantasy scene: ${prompt.slice(0, 200)}`, ref: null },
      ]
      for (const attempt of attempts) {
        try {
          const imagePart = await tryGemini(gemini, attempt.p, attempt.ref, apiKey, sizeConfig)
          if (imagePart) return corsResponse({ success: true, imageData: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || 'image/png' })
        } catch (err) {
          // Only continue retrying on content_policy — other errors propagate
          if (err.errorType !== 'content_policy') throw err
          console.warn(`Gemini blocked attempt, retrying with simpler prompt...`)
        }
      }
    }

    // Strategy 2: Imagen
    if (imagen) {
      try {
        const result = await tryImagen(imagen, prompt, apiKey, sizeConfig)
        if (result) return corsResponse({ success: true, imageData: result.imageData, mimeType: result.mimeType })
      } catch (err) {
        if (err.errorType !== 'content_policy') throw err
        console.warn('Imagen also blocked, exhausted all strategies')
      }
    }

    // Strategy 3: DALL-E 3 (OpenAI) — final fallback, more permissive than Gemini
    const openAiKey = process.env.OPENAI_API_KEY
    if (openAiKey) {
      try {
        const dalleResult = await tryDalle(prompt, openAiKey, sizeConfig)
        if (dalleResult) return corsResponse({ success: true, imageData: dalleResult.imageData, mimeType: 'image/png' })
      } catch (err) {
        console.warn('DALL-E 3 also failed:', err.message)
      }
    }

    const errorCode = `DS-${Date.now().toString(36).toUpperCase()}`
    console.error(`generate-image unavailable [${errorCode}]`)
    return corsResponse({ success: false, error: 'unavailable', errorType: 'unavailable', errorCode })

  } catch (err) {
    if (err instanceof Response) return err
    const errorCode = `DS-${Date.now().toString(36).toUpperCase()}`
    const isPolicy = err.errorType === 'content_policy' ||
      (err.message || '').toLowerCase().includes('safety') ||
      (err.message || '').toLowerCase().includes('policy') ||
      (err.message || '').toLowerCase().includes('person') ||
      (err.message || '').toLowerCase().includes('public figure')
    console.error(`generate-image error [${errorCode}]:`, err.message)
    return corsResponse({
      success: false,
      error: isPolicy ? 'content_policy' : err.message,
      errorType: isPolicy ? 'content_policy' : 'server_error',
      errorCode,
    }, isPolicy ? 200 : 500)
  }
}

export const config = { path: '/api/generate-image' }
