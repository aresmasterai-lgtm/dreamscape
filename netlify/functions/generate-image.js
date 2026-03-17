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

    const attemptGenerate = async (attemptPrompt) => {
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

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          }),
        }
      )

      const data = await response.json()

      if (!response.ok || data.error) {
        const msg = data.error?.message || `Gemini API error ${response.status}`
        throw new Error(msg)
      }

      const responseParts = data.candidates?.[0]?.content?.parts || []
      const finishReason = data.candidates?.[0]?.finishReason
      if (finishReason && finishReason !== 'STOP') {
        console.warn('Gemini non-STOP finish reason:', finishReason)
      }

      return responseParts.find(p => p.inlineData) || null
    }

    let imagePart = await attemptGenerate(prompt)

    if (!imagePart) {
      console.warn('First attempt returned no image — retrying with simplified prompt')
      const simplified = `Digital artwork, highly detailed, vibrant colors, professional quality: ${prompt.slice(0, 300)}`
      imagePart = await attemptGenerate(simplified)
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
