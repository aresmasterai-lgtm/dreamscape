// ── Background Removal via OpenAI GPT-Image-1 ────────────────
// Uses gpt-image-1 edit endpoint to remove background and return
// a transparent PNG ready for print-on-demand products
import { requireAuth, corsResponse, optionsResponse } from './auth-middleware.js'

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const { user } = await requireAuth(req)
    const { imageDataUrl, prompt = 'Remove the background, keep only the main subject on a transparent background. Clean edges, high quality.' } = await req.json()

    if (!imageDataUrl) return corsResponse({ error: 'imageDataUrl required' }, 400)

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return corsResponse({ error: 'OpenAI API key not configured' }, 500)

    // Convert dataUrl to blob for FormData
    const match = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/)
    if (!match) return corsResponse({ error: 'Invalid image format' }, 400)

    const mimeType = match[1]
    const base64   = match[2]
    const binary   = Buffer.from(base64, 'base64')

    // Build multipart form — OpenAI images/edits requires form data
    const boundary = `----FormBoundary${Date.now()}`
    const parts = []

    // image part
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="input.png"\r\nContent-Type: ${mimeType}\r\n\r\n`
    )
    const binaryPart = binary
    parts.push('\r\n')

    // prompt part
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${prompt}\r\n`)

    // model
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\ngpt-image-1\r\n`)

    // size — square 1024 works best for products
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\n1024x1024\r\n`)

    // n
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="n"\r\n\r\n1\r\n`)

    parts.push(`--${boundary}--\r\n`)

    // Manually build the buffer
    const textEncoder = new TextEncoder()
    const chunks = []
    for (const part of parts) {
      if (part === '\r\n' && chunks.length > 0) {
        // This is the binary separator — insert the actual binary data
        chunks.push(binaryPart)
        chunks.push(textEncoder.encode('\r\n'))
      } else {
        chunks.push(textEncoder.encode(part))
      }
    }

    const totalLength = chunks.reduce((s, c) => s + c.byteLength, 0)
    const body = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      body.set(new Uint8Array(chunk.buffer || chunk), offset)
      offset += chunk.byteLength
    }

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(45000),
    })

    const data = await res.json()

    if (!res.ok || data.error) {
      console.error('OpenAI edit error:', data.error?.message || 'unknown')
      return corsResponse({ error: data.error?.message || 'Background removal failed' }, 500)
    }

    const imageData = data.data?.[0]?.b64_json
    if (!imageData) return corsResponse({ error: 'No image returned' }, 500)

    return corsResponse({
      success: true,
      imageData,
      mimeType: 'image/png',
      dataUrl: `data:image/png;base64,${imageData}`,
    })

  } catch (err) {
    if (err instanceof Response) return err
    console.error('remove-background error:', err.message)
    return corsResponse({ error: err.message }, 500)
  }
}

export const config = { path: '/api/remove-background', timeout: 50 }
