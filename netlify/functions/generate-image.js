// ── Model resolution cache ────────────────────────────────────
// Cached at the module level so we only call ListModels once per
// cold start, not on every generation request.
let cachedImageModel = null
let cacheTime = 0
const CACHE_TTL = 1000 * 60 * 60 // re-check once per hour

async function resolveImageModel(apiKey) {
  const now = Date.now()
  if (cachedImageModel && (now - cacheTime) < CACHE_TTL) {
    return cachedImageModel
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`,
      { headers: { 'Content-Type': 'application/json' } }
    )
    const data = await res.json()
    const models = data.models || []

    // Find models that:
    // 1. Support generateContent
    // 2. Have "image" in the name (image generation models)
    // 3. Are not vision/understanding models (those accept images as input, not output)
    const imageGenModels = models.filter(m => {
      const name = (m.name || '').toLowerCase()
      const methods = m.supportedGenerationMethods || []
      return methods.includes('generateContent') &&
             (name.includes('image-generation') ||
              name.includes('flash-exp') ||
              name.includes('imagen'))
    })

    // Sort: prefer "image-generation" in name, then "flash-exp", then anything else
    imageGenModels.sort((a, b) => {
      const score = (n) => {
        if (n.includes('image-generation')) return 3
        if (n.includes('2.0') && n.includes('flash')) return 2
        if (n.includes('flash-exp')) return 1
        return 0
      }
      return score(b.name) - score(a.name)
    })

    if (imageGenModels.length > 0) {
      // Strip the "models/" prefix — the API path uses just the model ID
      const modelId = imageGenModels[0].name.replace('models/', '')
      console.log(`Resolved image model: ${modelId} (from ${imageGenModels.length} candidates)`)
      cachedImageModel = modelId
      cacheTime = now
      return modelId
    }
  } catch (err) {
    console.warn('ListModels failed, falling back to known model:', err.message)
  }

  // Hard fallback if ListModels fails entirely
  return 'gemini-2.0-flash-exp'
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
    if (!prompt) {
      return new Response(JSON.stringify({ success: false, error: 'Prompt is required' }), { status: 400, headers })
    }

    const apiKey = process.env.GEMINI_API_KEY

    // Resolve the correct model dynamically
    let model = await resolveImageModel(apiKey)

    const buildParts = (attemptPrompt) => {
      const parts = []
      if (referenceImage) {
        const match = referenceImage.match(/^data:(image\/[^;]+);base64,(.+)$/)
        if (match) {
          parts.push({ inline_data: { mime_type: match[1], data: match[2] } })
          parts.push({ text: `Using this reference image for style and subject inspiration, generate a high quality artwork: ${attemptPrompt}` })
        } else {
          parts.push({ text: `Generate a high quality artwork image: ${attemptPrompt}` })
        }
      } else {
        parts.push({ text: `Generate a high quality artwork image: ${attemptPrompt}` })
      }
      return parts
    }

    const callGemini = async (attemptModel, attemptPrompt) => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${attemptModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: buildParts(attemptPrompt) }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          }),
        }
      )
      const data = await res.json()

      // Model no longer valid — bust the cache and try to re-resolve
      const errMsg = data.error?.message || ''
      if (data.error?.code === 404 || errMsg.includes('not found') || errMsg.includes('not supported')) {
        console.warn(`Model ${attemptModel} is no longer valid — busting cache`)
        cachedImageModel = null
        cacheTime = 0
        return { invalid: true }
      }

      if (!res.ok || data.error) throw new Error(errMsg || `Gemini error ${res.status}`)

      const finishReason = data.candidates?.[0]?.finishReason
      if (finishReason && finishReason !== 'STOP') console.warn(`Finish reason: ${finishReason}`)

      const parts = data.candidates?.[0]?.content?.parts || []
      return { imagePart: parts.find(p => p.inlineData) || null }
    }

    // First attempt with resolved model
    let result = await callGemini(model, prompt)

    // If that model is now invalid, re-resolve and try once more
    if (result.invalid) {
      model = await resolveImageModel(apiKey)
      result = await callGemini(model, prompt)
    }

    // Retry with simplified prompt if model worked but returned no image
    if (!result.invalid && !result.imagePart) {
      console.warn('No image returned — retrying with simplified prompt')
      const simplified = `Digital artwork, highly detailed, vibrant colors, professional quality: ${prompt.slice(0, 300)}`
      result = await callGemini(model, simplified)
    }

    if (!result.imagePart) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No image was returned. Try rephrasing your prompt and generating again.',
      }), { status: 200, headers })
    }

    return new Response(JSON.stringify({
      success: true,
      imageData: result.imagePart.inlineData.data,
      mimeType: result.imagePart.inlineData.mimeType || 'image/png',
    }), { status: 200, headers })

  } catch (err) {
    console.error('generate-image error:', err.message)
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers })
  }
}

export const config = { path: '/api/generate-image' }
