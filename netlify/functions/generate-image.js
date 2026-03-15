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

    const generateImage = async (attemptPrompt) => {
      const parts = []

      if (referenceImage) {
        const match = referenceImage.match(/^data:(image\/[^;]+);base64,(.+)$/)
        if (match) {
          parts.push({ inline_data: { mime_type: match[1], data: match[2] } })
          parts.push({ text: `Using this reference image for style and subject inspiration, generate a high quality artwork: ${attemptPrompt}. Generate ONLY the image, no text response.` })
        } else {
          parts.push({ text: `Generate a high quality artwork image: ${attemptPrompt}. Generate ONLY the image, no text response.` })
        }
      } else {
        parts.push({ text: `Generate a high quality artwork image: ${attemptPrompt}. Generate ONLY the image, no text response.` })
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ['IMAGE'] },
          }),
        }
      )

      const data = await response.json()
      if (data.error) throw new Error(data.error.message)

      const responseParts = data.candidates?.[0]?.content?.parts || []
      const imagePart = responseParts.find(p => p.inlineData)
      return imagePart || null
    }

    // Try generating — retry once with simplified prompt if first attempt fails
    let imagePart = await generateImage(prompt)

    if (!imagePart) {
      // Retry with a more direct prompt
      const simplifiedPrompt = `Digital artwork: ${prompt.slice(0, 200)}, highly detailed, vibrant colors, professional quality`
      imagePart = await generateImage(simplifiedPrompt)
    }

    if (!imagePart) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Image generation failed after retry. Please try refining your prompt and try again.'
      }), { status: 200, headers })
    }

    return new Response(JSON.stringify({
      success: true,
      imageData: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
    }), { status: 200, headers })

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers })
  }
}

export const config = { path: '/api/generate-image' }
