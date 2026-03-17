// Temporary diagnostic endpoint — call this to see exactly what your API key has access to
// Visit: https://trydreamscape.com/api/gemini-diag after deploy
// DELETE this file once image generation is confirmed working

export default async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not set' }), { status: 500, headers })

  const results = {}

  // 1. List all available models
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`)
    const data = await res.json()
    results.listModels = {
      status: res.status,
      error: data.error?.message,
      totalModels: data.models?.length,
      imageModels: data.models
        ?.filter(m => {
          const n = m.name.toLowerCase()
          return n.includes('image') || n.includes('imagen') || n.includes('flash-exp')
        })
        ?.map(m => ({ name: m.name, methods: m.supportedGenerationMethods })),
    }
  } catch (e) { results.listModels = { error: e.message } }

  // 2. Test gemini-2.0-flash-exp with IMAGE modality
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Generate a simple red circle' }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      }
    )
    const data = await res.json()
    results.flashExp = {
      status: res.status,
      error: data.error?.message,
      finishReason: data.candidates?.[0]?.finishReason,
      partTypes: data.candidates?.[0]?.content?.parts?.map(p => Object.keys(p)[0]),
      hasImage: data.candidates?.[0]?.content?.parts?.some(p => p.inlineData),
    }
  } catch (e) { results.flashExp = { error: e.message } }

  // 3. Test imagen-3.0-generate-002
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: 'A simple red circle' }],
          parameters: { sampleCount: 1 },
        }),
      }
    )
    const data = await res.json()
    results.imagen3 = {
      status: res.status,
      error: data.error?.message,
      hasPredictions: !!data.predictions?.length,
    }
  } catch (e) { results.imagen3 = { error: e.message } }

  // 4. Test gemini-2.0-flash-preview-image-generation
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Generate a simple red circle' }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      }
    )
    const data = await res.json()
    results.flashPreview = {
      status: res.status,
      error: data.error?.message,
      finishReason: data.candidates?.[0]?.finishReason,
      hasImage: data.candidates?.[0]?.content?.parts?.some(p => p.inlineData),
    }
  } catch (e) { results.flashPreview = { error: e.message } }

  return new Response(JSON.stringify(results, null, 2), { status: 200, headers })
}

export const config = { path: '/api/gemini-diag' }
