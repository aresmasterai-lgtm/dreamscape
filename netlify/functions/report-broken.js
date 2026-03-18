import { requireAuthLight, corsResponse, optionsResponse } from './auth-middleware.js'
import { createClient } from '@supabase/supabase-js'

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST') return corsResponse({ error: 'Method not allowed' }, 405)

  try {
    const { user } = await requireAuthLight(req)
    const { resourceId, resourceType } = await req.json()

    if (!resourceId || !['artwork', 'product'].includes(resourceType)) {
      return corsResponse({ error: 'Invalid request' }, 400)
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const table = resourceType === 'artwork' ? 'artwork' : 'products'

    // Get the resource to find the owner and title
    const { data: resource } = await supabase
      .from(table)
      .select('id, user_id, title')
      .eq('id', resourceId)
      .single()

    if (!resource) return corsResponse({ error: 'Resource not found' }, 404)

    // Avoid duplicate reports — only flag if not already broken
    const { data: existing } = await supabase
      .from(table)
      .select('broken_image')
      .eq('id', resourceId)
      .single()

    if (existing?.broken_image) {
      return corsResponse({ ok: true, alreadyFlagged: true })
    }

    // Mark as broken
    await supabase
      .from(table)
      .update({
        broken_image: true,
        broken_reported_at: new Date().toISOString(),
      })
      .eq('id', resourceId)

    // Send in-app notification to the owner
    const isArtwork = resourceType === 'artwork'
    await supabase.from('notifications').insert({
      user_id: resource.user_id,
      type: isArtwork ? 'broken_artwork' : 'broken_product',
      title: isArtwork ? 'Artwork image unavailable' : 'Product image unavailable',
      message: `Your ${isArtwork ? 'artwork' : 'product'} "${resource.title || 'Untitled'}" has a broken image and has been hidden from public view. Please visit your profile to re-upload or delete it.`,
      resource_id: resourceId,
    })

    return corsResponse({ ok: true })

  } catch (err) {
    if (err instanceof Response) return err
    console.error('report-broken error:', err.message)
    return corsResponse({ error: err.message }, 500)
  }
}

export const config = { path: '/api/report-broken' }
