// ── Gemini Image Generation ───────────────────────────────────
// Strategy 1: Gemini flash/pro image model (generateContent + IMAGE modality)
// Strategy 2: Imagen 4 predict endpoint
// Models resolved dynamically from ListModels API — self-healing on renames.

let cachedGeminiModel = null
let cachedImagenModel = null
let cacheTime = 0
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

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

    // Gemini image model — supports generateContent and has "image" in name
    const geminiCandidates = models.filter(m => {
      const name = (m.name || '').toLowerCase()
      const methods = m.supportedGenerationMethods || []
      return methods.includes('generateContent') && name.includes('image')
    }).map(m => m.name.replace('models/', ''))

    // Prefer: 2.5 > 3 pro > 3.1 > anything else
    const geminiScore = (n) => {
      if (n.includes('2.5')) return 4
      if (n.includes('3-pro')) return 3
      if (n.includes('3.1')) return 2
      if (n.includes('3')) return 1
      return 0
    }
    geminiCandidates.sort((a, b) => geminiScore(b) - geminiScore(a))

    // Imagen model — supports predict and has "imagen" in name
    const imagenCandidates = models.filter(m => {
      const name = (m.name || '').toLowerCase()
      const methods = m.supportedGenerationMethods || []
      return methods.includes('predict') && name.includes('imagen')
    }).map(m => m.name.replace('models/', ''))

    // Prefer: ultra > standard, higher version number first
    imagenCandidates.sort((a, b) => {
      if (a.includes('ultra') && !b.includes('ultra')) return -1
      if (b.includes('ultra') && !a.includes('ultra')) return 1
      return b.localeCompare(a)
    })

    console.log('Gemini image candidates:', geminiCandidates)
    console.log('Imagen candidates:', imagenCandidates)

    if (geminiCandidates.length) { cachedGeminiModel = geminiCandidates[0]; cacheTime = now }
    if (imagenCandidates.length) { cachedImagenModel = imagenCandidates[0]; cacheTime = now }

  } catch (err) {
    console.warn('ListModels failed:', err.message)
    // Hard fallbacks from diagnostic results
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: buildParts(prompt, referenceImage) }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    }
  )
  const data = await res.json()
  console.log(`Gemini ${model}:`, res.status, data.error?.message || data.candidates?.[0]?.finishReason,
    'parts:', data.candidates?.[0]?.content?.parts?.map(p => Object.keys(p)[0]))

  if (data.error?.code === 404 || (data.error?.message || '').includes('not found')) {
    cachedGeminiModel = null; cacheTime = 0
    return null
  }
  if (data.error) throw new Error(data.error.message)
  return (data.candidates?.[0]?.content?.parts || []).find(p => p.inlineData) || null
}

async function tryImagen(model, prompt, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1 },
      }),
    }
  )
  const data = await res.json()
  console.log(`Imagen ${model}:`, res.status, data.error?.message || (data.predictions?.length ? 'ok' : 'no predictions'))

  if (data.error?.code === 404 || (data.error?.message || '').includes('not found')) {
    cachedImagenModel = null; cacheTime = 0
    return null
  }
  if (data.error) throw new Error(data.error.message)
  const p = data.predictions?.[0]
  return p?.bytesBase64Encoded ? { imageData: p.bytesBase64Encoded, mimeType: p.mimeType || 'image/png' } : null
}

export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers })

  try {
    const { prompt, referenceImage } = await req.json()
    if (!prompt) return new Response(JSON.stringify({ success: false, error: 'Prompt is required' }), { status: 400, headers })

    const apiKey = process.env.GEMINI_API_KEY
    const { gemini, imagen } = await resolveModels(apiKey)

    // ── Strategy 1: Gemini image model ───────────────────────────
    if (gemini) {
      const imagePart = await tryGemini(gemini, prompt, referenceImage, apiKey)
      if (imagePart) {
        return new Response(JSON.stringify({
          success: true,
          imageData: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType || 'image/png',
        }), { status: 200, headers })
      }
      // Retry simplified
      const simple = `Digital artwork, vibrant, highly detailed: ${prompt.slice(0, 200)}`
      const retry = await tryGemini(gemini, simple, referenceImage, apiKey)
      if (retry) {
        return new Response(JSON.stringify({
          success: true,
          imageData: retry.inlineData.data,
          mimeType: retry.inlineData.mimeType || 'image/png',
        }), { status: 200, headers })
      }
    }

    // ── Strategy 2: Imagen 4 ─────────────────────────────────────
    if (imagen) {
      console.log('Falling back to Imagen:', imagen)
      const result = await tryImagen(imagen, prompt, apiKey)
      if (result) {
        return new Response(JSON.stringify({
          success: true,
          imageData: result.imageData,
          mimeType: result.mimeType,
        }), { status: 200, headers })
      }
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Image generation is temporarily unavailable. Please try again in a moment.',
    }), { status: 200, headers })

  } catch (err) {
    console.error('generate-image error:', err.message)
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers })
  }
}

export const config = { path: '/api/generate-image' }
