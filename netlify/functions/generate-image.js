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

    // Try models in order — first one that works wins
    // Gemini image generation model names change frequently; this list is ordered newest to oldest
    const MODELS_TO_TRY = [
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-preview-image-generation',
      'gemini-2.0-flash',
    ]

    const attemptWithModel = async (model, attemptPrompt) => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

      // Model not found or not supported — signal to try next model
      if (data.error?.code === 404 || data.error?.status === 'NOT_FOUND' ||
          (data.error?.message || '').includes('not found') ||
          (data.error?.message || '').includes('not supported')) {
        return { notFound: true, model }
      }

      if (!res.ok || data.error) {
        throw new Error(data.error?.message || `Gemini error ${res.status}`)
      }

      const finishReason = data.candidates?.[0]?.finishReason
      if (finishReason && finishReason !== 'STOP') {
        console.warn(`Model ${model} finish reason:`, finishReason)
      }

      const parts = data.candidates?.[0]?.content?.parts || []
      return { imagePart: parts.find(p => p.inlineData) || null, model }
    }

    // Try each model until one works
    let imagePart = null
    let workingModel = null

    for (const model of MODELS_TO_TRY) {
      const result = await attemptWithModel(model, prompt)
      if (result.notFound) {
        console.warn(`Model ${result.model} not found, trying next...`)
        continue
      }
      imagePart = result.imagePart
      workingModel = result.model
      break
    }

    // Retry with simplified prompt if no image returned
    if (workingModel && !imagePart) {
      console.warn(`${workingModel} returned no image — retrying with simplified prompt`)
      const simplified = `Digital artwork, highly detailed, vibrant colors, professional quality: ${prompt.slice(0, 300)}`
      const retry = await attemptWithModel(workingModel, simplified)
      imagePart = retry.imagePart
    }

    if (!imagePart) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No image was returned. Try rephrasing your prompt and generating again.',
      }), { status: 200, headers })
    }

    return new Response(JSON.stringify({
      success: true,
      imageData: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
    }), { status: 200, headers })

  } catch (err) {
    console.error('generate-image error:', err.message)
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers })
  }
}

export const config = { path: '/api/generate-image' }
