import { requireAuth, checkRateLimit, checkRateLimitAsync, corsResponse, optionsResponse } from './auth-middleware.js'
import { createClient } from '@supabase/supabase-js'

// ── Model resolution cache ────────────────────────────────────
let cachedGeminiModel = null
let cachedImagenModel = null
let cacheTime = 0
const CACHE_TTL = 1000 * 60 * 60

const GEMINI_FALLBACK = 'gemini-2.0-flash-exp'
const IMAGEN_FALLBACK  = 'imagen-3.0-generate-001'

async function resolveModels(apiKey) {
  const now = Date.now()
  if ((cachedGeminiModel || cachedImagenModel) && (now - cacheTime) < CACHE_TTL) {
    return { gemini: cachedGeminiModel || GEMINI_FALLBACK, imagen: cachedImagenModel || IMAGEN_FALLBACK }
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`,
      { headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) throw new Error(`ListModels HTTP ${res.status}`)
    const data = await res.json()
    const models = data.models || []

    const geminiCandidates = models.filter(m => {
      const name = (m.name || '').toLowerCase()
      const methods = m.supportedGenerationMethods || []
      return methods.includes('generateContent') && (name.includes('image') || name.includes('flash-exp') || name.includes('2.0-flash'))
    }).map(m => m.name.replace('models/', ''))

    const geminiScore = (n) => {
      if (n.includes('2.5')) return 5; if (n.includes('2.0')) return 4
      if (n.includes('3-pro')) return 3; if (n.includes('3.1')) return 2
      if (n.includes('3')) return 1; return 0
    }
    geminiCandidates.sort((a, b) => geminiScore(b) - geminiScore(a))

    const imagenCandidates = models.filter(m => {
      const name = (m.name || '').toLowerCase()
      const methods = m.supportedGenerationMethods || []
      return (methods.includes('predict') || methods.includes('generateImages')) && name.includes('imagen')
    }).map(m => m.name.replace('models/', ''))
    imagenCandidates.sort((a, b) => {
      if (a.includes('4') && !b.includes('4')) return -1
      if (b.includes('4') && !a.includes('4')) return 1
      if (a.includes('ultra') && !b.includes('ultra')) return -1
      return b.localeCompare(a)
    })

    cachedGeminiModel = geminiCandidates[0] || GEMINI_FALLBACK
    cachedImagenModel = imagenCandidates[0] || IMAGEN_FALLBACK
    cacheTime = now
    console.log(`[generate-image] Resolved: gemini=${cachedGeminiModel} imagen=${cachedImagenModel}`)
  } catch (err) {
    console.warn('[generate-image] ListModels failed:', err.message)
    if (!cachedGeminiModel) cachedGeminiModel = GEMINI_FALLBACK
    if (!cachedImagenModel) cachedImagenModel = IMAGEN_FALLBACK
    cacheTime = now
  }
  return { gemini: cachedGeminiModel, imagen: cachedImagenModel }
}

function buildParts(prompt, referenceImage) {
  if (referenceImage) {
    const match = referenceImage.match(/^data:(image\/[^;]+);base64,(.+)$/)
    if (match) return [
      { inline_data: { mime_type: match[1], data: match[2] } },
      { text: `Using this reference photo of a person, create a stunning artistic portrait. Capture their likeness, facial features, and expression faithfully while rendering in the requested style: ${prompt}` },
    ]
  }
  return [{ text: `Generate a high quality artwork image: ${prompt}` }]
}

async function tryGemini(model, prompt, referenceImage, apiKey, sizeConfig = null) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(22000),
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
  if (data.error?.code === 404 || errMsg.includes('not found') || errMsg.includes('not supported')) {
    cachedGeminiModel = null; cacheTime = 0; return null
  }
  if (data.error) {
    const isPolicy = data.error.code === 400 || errMsg.toLowerCase().includes('safety') || errMsg.toLowerCase().includes('policy') || errMsg.toLowerCase().includes('person') || errMsg.toLowerCase().includes('harmful')
    if (isPolicy) throw Object.assign(new Error(errMsg || 'Content policy'), { errorType: 'content_policy' })
    throw new Error(errMsg)
  }
  const candidate = data.candidates?.[0]
  const finishReason = candidate?.finishReason || ''
  if (['SAFETY', 'PROHIBITED_CONTENT', 'RECITATION'].includes(finishReason)) {
    throw Object.assign(new Error(`Blocked: ${finishReason}`), { errorType: 'content_policy' })
  }
  const blockReason = data.promptFeedback?.blockReason
  if (blockReason) throw Object.assign(new Error(`Prompt blocked: ${blockReason}`), { errorType: 'content_policy' })
  return (candidate?.content?.parts || []).find(p => p.inlineData) || null
}

async function tryImagen(model, prompt, apiKey, sizeConfig = null) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
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
    if (msg.toLowerCase().includes('safety') || msg.toLowerCase().includes('policy') || data.error.code === 400) {
      throw Object.assign(new Error(msg), { errorType: 'content_policy' })
    }
    throw new Error(msg)
  }
  const p = data.predictions?.[0]
  return p?.bytesBase64Encoded ? { imageData: p.bytesBase64Encoded, mimeType: p.mimeType || 'image/png' } : null
}

// ── GPT-Image-1 — best for photorealistic portraits with reference photo ──
async function tryGptImage1(prompt, referenceImage, apiKey, sizeConfig = null) {
  const size = !sizeConfig || sizeConfig.width === sizeConfig.height ? '1024x1024'
    : sizeConfig.width > sizeConfig.height ? '1536x1024' : '1024x1536'

  // GPT-Image-1 supports image edits with reference — use edits endpoint when photo attached
  if (referenceImage) {
    const match = referenceImage.match(/^data:(image\/[^;]+);base64,(.+)$/)
    if (match) {
      try {
        const byteString = atob(match[2])
        const bytes = new Uint8Array(byteString.length)
        for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i)
        const blob = new Blob([bytes], { type: match[1] })

        const form = new FormData()
        form.append('image', blob, 'reference.png')
        form.append('prompt', `Create a photorealistic artistic portrait based on this reference photo. Maintain the person's likeness, facial structure, and key features. ${prompt}`)
        form.append('model', 'gpt-image-1')
        form.append('size', size)
        form.append('n', '1')

        const res = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: form,
          signal: AbortSignal.timeout(45000),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error.message)
        const b64 = data.data?.[0]?.b64_json
        if (b64) { console.log('GPT-Image-1 edit (reference photo) succeeded'); return { imageData: b64, mimeType: 'image/png' } }
      } catch (err) {
        console.warn('GPT-Image-1 edit failed, falling back to generation:', err.message)
      }
    }
  }

  // Standard generation (no reference or edit failed)
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: prompt.slice(0, 4000),
      size,
      n: 1,
      output_format: 'png',
    }),
    signal: AbortSignal.timeout(40000),
  })
  const data = await res.json()
  if (data.error) {
    if (data.error.code === 'content_policy_violation') throw Object.assign(new Error(data.error.message), { errorType: 'content_policy' })
    throw new Error(data.error.message)
  }
  const b64 = data.data?.[0]?.b64_json
  if (!b64) return null
  console.log('GPT-Image-1 generation succeeded')
  return { imageData: b64, mimeType: 'image/png' }
}

// ── DALL-E 3 — legacy fallback ────────────────────────────────
async function tryDalle(prompt, apiKey, sizeConfig = null) {
  const size = !sizeConfig || sizeConfig.width === sizeConfig.height ? '1024x1024'
    : sizeConfig.width > sizeConfig.height ? '1792x1024' : '1024x1792'

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    signal: AbortSignal.timeout(18000),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'dall-e-3', prompt: prompt.slice(0, 4000), n: 1, size, response_format: 'b64_json', quality: 'standard' }),
  })
  const data = await res.json()
  if (data.error) {
    if (data.error.code === 'content_policy_violation') throw Object.assign(new Error(data.error.message), { errorType: 'content_policy' })
    throw new Error(data.error.message)
  }
  const b64 = data.data?.[0]?.b64_json
  if (!b64) return null
  console.log('DALL-E 3 succeeded')
  return { imageData: b64, mimeType: 'image/png' }
}

async function checkServerLimit(userId, tier, supabase) {
  if (tier === 'studio') return { allowed: true }
  const LIMITS = { free: 10, starter: 50, pro: 200, business: 100 }
  const limit = LIMITS[tier] ?? 10
  const startOfMonth = new Date()
  startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
  const { count } = await supabase.from('artwork').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', startOfMonth.toISOString())
  return { allowed: (count || 0) < limit, used: count || 0, limit }
}

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  try {
    const { user, profile, supabase } = await requireAuth(req)
    if (!(await checkRateLimitAsync(`gen:${user.id}`, 10))) return corsResponse({ error: 'Too many requests — slow down.' }, 429)

    const tier = profile?.subscription_tier || 'free'
    const limitCheck = await checkServerLimit(user.id, tier, supabase)
    if (!limitCheck.allowed) return corsResponse({ error: `You've reached your ${limitCheck.limit} generation limit for this month on the ${tier} plan.`, limitReached: true }, 403)

    const { prompt, referenceImage, aspectRatio } = await req.json()
    if (!prompt) return corsResponse({ error: 'Prompt is required' }, 400)

    const geminiKey = process.env.GEMINI_API_KEY
    const openAiKey = process.env.OPENAI_API_KEY
    const { gemini, imagen } = await resolveModels(geminiKey)

    const RATIO_MAP = {
      square:    { width: 1024, height: 1024 },
      portrait:  { width: 896,  height: 1152 },
      landscape: { width: 1152, height: 896  },
      wide:      { width: 1344, height: 768  },
    }
    const sizeConfig = RATIO_MAP[aspectRatio] || RATIO_MAP.square

    // ── Strategy 1: GPT-Image-1 when reference photo attached ──
    // This model is significantly better at preserving likeness from reference photos
    if (referenceImage && openAiKey) {
      try {
        const result = await tryGptImage1(prompt, referenceImage, openAiKey, sizeConfig)
        if (result) return corsResponse({ success: true, imageData: result.imageData, mimeType: result.mimeType, model: 'gpt-image-1' })
      } catch (err) {
        if (err.errorType === 'content_policy') throw err
        console.warn('GPT-Image-1 failed with reference, falling through to Gemini:', err.message)
      }
    }

    // ── Strategy 2: Gemini (primary for non-photo prompts) ─────
    if (gemini) {
      const attempts = [
        { p: prompt,                                                         ref: referenceImage },
        { p: `Illustration: ${prompt.slice(0, 300)}`,                        ref: referenceImage },
        { p: `Colorful digital art, fantasy scene: ${prompt.slice(0, 200)}`, ref: null },
      ]
      for (const attempt of attempts) {
        try {
          const imagePart = await tryGemini(gemini, attempt.p, attempt.ref, geminiKey, sizeConfig)
          if (imagePart) return corsResponse({ success: true, imageData: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || 'image/png', model: 'gemini' })
        } catch (err) {
          if (err.errorType !== 'content_policy') throw err
          console.warn('Gemini blocked, retrying with simpler prompt...')
        }
      }
    }

    // ── Strategy 3: Imagen ──────────────────────────────────────
    if (imagen) {
      try {
        const result = await tryImagen(imagen, prompt, geminiKey, sizeConfig)
        if (result) return corsResponse({ success: true, imageData: result.imageData, mimeType: result.mimeType, model: 'imagen' })
      } catch (err) {
        if (err.errorType !== 'content_policy') throw err
        console.warn('Imagen blocked')
      }
    }

    // ── Strategy 4: GPT-Image-1 without reference (general) ────
    if (openAiKey) {
      try {
        const result = await tryGptImage1(prompt, null, openAiKey, sizeConfig)
        if (result) return corsResponse({ success: true, imageData: result.imageData, mimeType: 'image/png', model: 'gpt-image-1' })
      } catch (err) {
        if (err.errorType === 'content_policy') throw err
        console.warn('GPT-Image-1 generation failed:', err.message)
      }
    }

    // ── Strategy 5: DALL-E 3 legacy fallback ───────────────────
    if (openAiKey) {
      try {
        const result = await tryDalle(prompt, openAiKey, sizeConfig)
        if (result) return corsResponse({ success: true, imageData: result.imageData, mimeType: 'image/png', model: 'dall-e-3' })
      } catch (err) {
        console.warn('DALL-E 3 failed:', err.message)
      }
    }

    const errorCode = `DS-${Date.now().toString(36).toUpperCase()}`
    console.error(`generate-image: all strategies exhausted [${errorCode}]`)
    return corsResponse({ success: false, error: 'unavailable', errorType: 'unavailable', errorCode })

  } catch (err) {
    if (err instanceof Response) return err
    const errorCode = `DS-${Date.now().toString(36).toUpperCase()}`
    const isPolicy = err.errorType === 'content_policy' || ['safety','policy','person','public figure'].some(w => (err.message || '').toLowerCase().includes(w))
    console.error(`generate-image error [${errorCode}]:`, err.message)
    return corsResponse({ success: false, error: isPolicy ? 'content_policy' : err.message, errorType: isPolicy ? 'content_policy' : 'server_error', errorCode }, isPolicy ? 200 : 500)
  }
}

export const config = { path: '/api/generate-image' }
