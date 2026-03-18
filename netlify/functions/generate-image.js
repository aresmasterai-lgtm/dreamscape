import { requireAuth, checkRateLimit, corsResponse, optionsResponse } from './auth-middleware.js'
import { createClient } from '@supabase/supabase-js'

// ── Model resolution cache ────────────────────────────────────
let cachedGeminiModel = null
let cachedImagenModel = null
let cacheTime = 0
const CACHE_TTL = 1000 * 60 * 60

async function resolveModels(apiKey) {
  const now = Date.now()
  if (cachedGeminiModel && cachedImagenModel && (now - cacheTime) < CACHE_TTL) {
    return { gemini: cachedGeminiModel, imagen: cachedImagenModel }
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`,
      { headers: { 'Content-Type': 'application/json' } }
    )
    const data = await res.json()
    const models = data.models || []
    const geminiCandidates = models.filter(m => {
      const name = (m.name || '').toLowerCase()
      const methods = m.supportedGenerationMethods || []
      return methods.includes('generateContent') && name.includes('image')
    }).map(m => m.name.replace('models/', ''))
    const geminiScore = (n) => {
      if (n.includes('2.5')) return 4
      if (n.includes('3-pro')) return 3
      if (n.includes('3.1')) return 2
      if (n.includes('3')) return 1
      return 0
    }
    geminiCandidates.sort((a, b) => geminiScore(b) - geminiScore(a))
    const imagenCandidates = models.filter(m => {
      const name = (m.name || '').toLowerCase()
      const methods = m.supportedGenerationMethods || []
      return methods.includes('predict') && name.includes('imagen')
    }).map(m => m.name.replace('models/', ''))
    imagenCandidates.sort((a, b) => {
      if (a.includes('ultra') && !b.includes('ultra')) return -1
      if (b.includes('ultra') && !a.includes('ultra')) return 1
      return b.localeCompare(a)
    })
    if (geminiCandidates.length) { cachedGeminiModel = geminiCandidates[0]; cacheTime = now }
    if (imagenCandidates.length) { cachedImagenModel = imagenCandidates[0]; cacheTime = now }
  } catch (err) {
    console.warn('ListModels failed:', err.message)
    if (!cachedGeminiModel) cachedGeminiModel = 'gemini-2.5-flash-image'
    if (!cachedImagenModel) cachedImagenModel = 'imagen-4.0-generate-001'
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

async function tryGemini(model, prompt, referenceImage, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: buildParts(prompt, referenceImage) }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    }
  )
  const data = await res.json()
  const errMsg = data.error?.message || ''
  if (data.error?.code === 404 || errMsg.includes('not found') || errMsg.includes('not supported')) {
    cachedGeminiModel = null; cacheTime = 0
    return null
  }
  if (data.error) throw new Error(errMsg)
  return (data.candidates?.[0]?.content?.parts || []).find(p => p.inlineData) || null
}

async function tryImagen(model, prompt, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1 } }),
    }
  )
  const data = await res.json()
  if (data.error?.code === 404) { cachedImagenModel = null; cacheTime = 0; return null }
  if (data.error) throw new Error(data.error.message)
  const p = data.predictions?.[0]
  return p?.bytesBase64Encoded ? { imageData: p.bytesBase64Encoded, mimeType: p.mimeType || 'image/png' } : null
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

    const { prompt, referenceImage } = await req.json()
    if (!prompt) return corsResponse({ error: 'Prompt is required' }, 400)

    const apiKey = process.env.GEMINI_API_KEY
    const { gemini, imagen } = await resolveModels(apiKey)

    // Strategy 1: Gemini
    if (gemini) {
      let imagePart = await tryGemini(gemini, prompt, referenceImage, apiKey)
      if (!imagePart) {
        const newModel = await resolveModels(apiKey)
        if (newModel.gemini) imagePart = await tryGemini(newModel.gemini, prompt, referenceImage, apiKey)
      }
      if (!imagePart) {
        const simple = `Digital artwork, vibrant, highly detailed: ${prompt.slice(0, 200)}`
        imagePart = await tryGemini(gemini, simple, referenceImage, apiKey)
      }
      if (imagePart) return corsResponse({ success: true, imageData: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || 'image/png' })
    }

    // Strategy 2: Imagen
    if (imagen) {
      const result = await tryImagen(imagen, prompt, apiKey)
      if (result) return corsResponse({ success: true, imageData: result.imageData, mimeType: result.mimeType })
    }

    return corsResponse({ success: false, error: 'Image generation is temporarily unavailable.' })

  } catch (err) {
    if (err instanceof Response) return err
    console.error('generate-image error:', err.message)
    return corsResponse({ error: err.message }, 500)
  }
}

export const config = { path: '/api/generate-image' }
