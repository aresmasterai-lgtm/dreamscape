// ── Gemini Image Generation ───────────────────────────────────
// Uses a two-strategy approach:
//   1. Gemini generateContent with responseModalities IMAGE (flash models)
//   2. Imagen 3 predict endpoint (stable, separate API)
// Whichever returns an image first wins.

let cachedGeminiModel = null
let cacheTime = 0
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

async function resolveGeminiImageModel(apiKey) {
  const now = Date.now()
  if (cachedGeminiModel && (now - cacheTime) < CACHE_TTL) return cachedGeminiModel

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`,
      { headers: { 'Content-Type': 'application/json' } }
    )
    const data = await res.json()
    const models = (data.models || [])
      .filter(m => {
        const name = (m.name || '').toLowerCase()
        const methods = m.supportedGenerationMethods || []
        return methods.includes('generateContent') && name.includes('image-generation')
      })
      .map(m => m.name.replace('models/', ''))

    console.log('Image-generation models found:', models)

    if (models.length > 0) {
      // Prefer 2.0 over older versions
      const best = models.find(m => m.includes('2.0')) || models[0]
      cachedGeminiModel = best
      cacheTime = now
      console.log('Using model:', best)
      return best
    }
  } catch (err) {
    console.warn('ListModels failed:', err.message)
  }
  return null
}

async function tryGeminiGenerate(model, parts, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    }
  )
  const data = await res.json()
  console.log(`Gemini ${model} response:`, JSON.stringify({
    status: res.status,
    error: data.error?.message,
    finishReason: data.candidates?.[0]?.finishReason,
    partTypes: data.candidates?.[0]?.content?.parts?.map(p => Object.keys(p).join(',')),
  }))

  if (data.error) {
    const msg = data.error.message || ''
    if (msg.includes('not found') || msg.includes('not supported') || data.error.code === 404) {
      cachedGeminiModel = null; cacheTime = 0 // bust cache
      return { modelInvalid: true }
    }
    throw new Error(msg)
  }

  const imagePart = (data.candidates?.[0]?.content?.parts || []).find(p => p.inlineData)
  return { imagePart: imagePart || null }
}

async function tryImagenGenerate(prompt, apiKey) {
  // Imagen 3 uses /predict not /generateContent
  const models = ['imagen-3.0-generate-002', 'imagen-3.0-fast-generate-001']
  for (const model of models) {
    try {
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
      console.log(`Imagen ${model} response:`, JSON.stringify({
        status: res.status,
        error: data.error?.message,
        hasPredictions: !!data.predictions?.length,
      }))

      if (data.error) continue

      const prediction = data.predictions?.[0]
      if (prediction?.bytesBase64Encoded) {
        return {
          imageData: prediction.bytesBase64Encoded,
          mimeType: prediction.mimeType || 'image/png',
        }
      }
    } catch (err) {
      console.warn(`Imagen ${model} failed:`, err.message)
    }
  }
  return null
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

    const buildParts = (p) => {
      if (referenceImage) {
        const match = referenceImage.match(/^data:(image\/[^;]+);base64,(.+)$/)
        if (match) return [
          { inline_data: { mime_type: match[1], data: match[2] } },
          { text: `Using this reference image for style inspiration, generate: ${p}` }
        ]
      }
      return [{ text: `Generate a high quality artwork image: ${p}` }]
    }

    // ── Strategy 1: Gemini flash image-generation model ──────────
    const geminiModel = await resolveGeminiImageModel(apiKey)
    if (geminiModel) {
      let result = await tryGeminiGenerate(geminiModel, buildParts(prompt), apiKey)

      if (result.modelInvalid) {
        // Cache busted — try to re-resolve once
        const newModel = await resolveGeminiImageModel(apiKey)
        if (newModel) result = await tryGeminiGenerate(newModel, buildParts(prompt), apiKey)
      }

      if (result.imagePart) {
        return new Response(JSON.stringify({
          success: true,
          imageData: result.imagePart.inlineData.data,
          mimeType: result.imagePart.inlineData.mimeType || 'image/png',
        }), { status: 200, headers })
      }

      // Retry with simplified prompt
      if (!result.modelInvalid) {
        const simple = `Digital artwork, vibrant colors, highly detailed: ${prompt.slice(0, 200)}`
        const retry = await tryGeminiGenerate(geminiModel, buildParts(simple), apiKey)
        if (retry.imagePart) {
          return new Response(JSON.stringify({
            success: true,
            imageData: retry.imagePart.inlineData.data,
            mimeType: retry.imagePart.inlineData.mimeType || 'image/png',
          }), { status: 200, headers })
        }
      }
    }

    // ── Strategy 2: Imagen 3 predict endpoint ────────────────────
    console.log('Gemini returned no image — trying Imagen 3')
    const imagenResult = await tryImagenGenerate(prompt, apiKey)
    if (imagenResult) {
      return new Response(JSON.stringify({
        success: true,
        imageData: imagenResult.imageData,
        mimeType: imagenResult.mimeType,
      }), { status: 200, headers })
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
