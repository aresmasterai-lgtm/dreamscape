export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers })
  }

  try {
    const { prompt, style } = await req.json()

    if (!prompt) {
      return new Response(JSON.stringify({ success: false, error: 'Prompt is required' }), { status: 400, headers })
    }

    const fullPrompt = style ? `${style}: ${prompt}` : prompt

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      }
    )

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message)
    }

    const parts = data.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find(p => p.inlineData)
    const textPart = parts.find(p => p.text)

    if (!imagePart) {
      const finishReason = data.candidates?.[0]?.finishReason || 'unknown'
      const debugText = textPart?.text || 'none'
      throw new Error(`No image in response. FinishReason: ${finishReason}. Text: ${debugText.substring(0, 200)}`)
    }

    return new Response(JSON.stringify({
      success: true,
      imageData: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
      description: textPart?.text || '',
    }), { status: 200, headers })

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers })
  }
}

export const config = {
  path: '/api/generate-image',
}
