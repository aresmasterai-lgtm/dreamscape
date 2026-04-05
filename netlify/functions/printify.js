/**
 * Printify API integration for Dreamscape
 * Handles: catalog browsing, product creation, order submission, webhooks
 * 
 * Printify API docs: https://developers.printify.com/
 */
import { requireAuth, corsResponse, optionsResponse } from './auth-middleware.js'
import { createClient } from '@supabase/supabase-js'

const PRINTIFY_BASE = 'https://api.printify.com/v1'

function printifyHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Dreamscape/1.0',
  }
}

async function printifyFetch(path, options = {}, apiKey) {
  const res = await fetch(`${PRINTIFY_BASE}${path}`, {
    ...options,
    headers: { ...printifyHeaders(apiKey), ...(options.headers || {}) },
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || `Printify ${res.status}`)
  return data
}

// ── Route handler ─────────────────────────────────────────────
export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const apiKey  = process.env.PRINTIFY_API_KEY
    const shopId  = process.env.PRINTIFY_SHOP_ID
    if (!apiKey)  return corsResponse({ error: 'Printify not configured' }, 503)

    const url    = new URL(req.url)
    const action = url.searchParams.get('action') || 'catalog'

    // ── Public: catalog browsing (no auth needed) ─────────────
    if (action === 'catalog') {
      const blueprintId = url.searchParams.get('blueprint_id')
      if (blueprintId) {
        // Get print providers and variants for a specific blueprint
        const [blueprint, providers] = await Promise.all([
          printifyFetch(`/catalog/blueprints/${blueprintId}.json`, {}, apiKey),
          printifyFetch(`/catalog/blueprints/${blueprintId}/print_providers.json`, {}, apiKey),
        ])
        return corsResponse({ blueprint, providers })
      }
      // List all blueprints (with caching hint)
      const blueprints = await printifyFetch('/catalog/blueprints.json', {}, apiKey)
      return corsResponse({ blueprints }, 200)
    }

    // ── Auth required for everything below ────────────────────
    const { user } = await requireAuth(req)

    if (action === 'create_product') {
      // Create a Printify product from a Dreamscape artwork
      const body = await req.json()
      const { blueprint_id, print_provider_id, variants, image_url, title, description } = body

      if (!shopId) return corsResponse({ error: 'PRINTIFY_SHOP_ID not configured' }, 503)

      // Step 1: Upload image to Printify
      const uploadRes = await printifyFetch('/uploads/images.json', {
        method: 'POST',
        body: JSON.stringify({
          file_name: `dreamscape-${Date.now()}.png`,
          url: image_url,
        }),
      }, apiKey)

      const imageId = uploadRes.id
      if (!imageId) throw new Error('Printify image upload failed')

      // Step 2: Create product with uploaded image
      const product = await printifyFetch(`/shops/${shopId}/products.json`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: description || title,
          blueprint_id,
          print_provider_id,
          variants: variants.map(v => ({
            id: v.id,
            price: Math.round(v.price * 100), // Printify uses cents
            is_enabled: true,
          })),
          print_areas: [{
            variant_ids: variants.map(v => v.id),
            placeholders: [{
              position: 'front',
              images: [{ id: imageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
            }],
          }],
        }),
      }, apiKey)

      // Step 3: Publish product
      await printifyFetch(`/shops/${shopId}/products/${product.id}/publish.json`, {
        method: 'POST',
        body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
      }, apiKey)

      return corsResponse({ success: true, product_id: product.id, printify_id: product.id })
    }

    if (action === 'create_order') {
      const body = await req.json()
      const { line_items, shipping_address, external_id } = body
      if (!shopId) return corsResponse({ error: 'PRINTIFY_SHOP_ID not configured' }, 503)

      const order = await printifyFetch(`/shops/${shopId}/orders.json`, {
        method: 'POST',
        body: JSON.stringify({
          external_id,
          line_items,
          shipping_method: 1, // standard
          send_shipping_notification: true,
          address_to: shipping_address,
        }),
      }, apiKey)

      return corsResponse({ success: true, order_id: order.id })
    }

    if (action === 'shipping_cost') {
      const body = await req.json()
      if (!shopId) return corsResponse({ error: 'PRINTIFY_SHOP_ID not configured' }, 503)

      const rates = await printifyFetch(`/shops/${shopId}/orders/shipping.json`, {
        method: 'POST',
        body: JSON.stringify(body),
      }, apiKey)

      return corsResponse({ rates })
    }

    if (action === 'mockup') {
      // Get mockup images for a product
      const productId = url.searchParams.get('product_id')
      if (!shopId || !productId) return corsResponse({ error: 'Missing shop or product ID' }, 400)

      const product = await printifyFetch(`/shops/${shopId}/products/${productId}.json`, {}, apiKey)
      const mockups = product.images?.map(img => img.src) || []
      return corsResponse({ mockups })
    }

    if (action === 'shops') {
      const shops = await printifyFetch('/shops.json', {}, apiKey)
      return corsResponse({ shops })
    }

    if (action === 'variants') {
      // Get variants for a blueprint + print provider combination
      const blueprintId = url.searchParams.get('blueprint_id')
      const providerId  = url.searchParams.get('provider_id')
      if (!blueprintId || !providerId) return corsResponse({ error: 'Missing blueprint_id or provider_id' }, 400)
      const data = await printifyFetch(`/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`, {}, apiKey)
      return corsResponse({ variants: data.variants || data || [] })
    }

    if (action === 'best_provider') {
      // Auto-select best (cheapest) print provider for a blueprint
      const blueprintId = url.searchParams.get('blueprint_id')
      if (!blueprintId) return corsResponse({ error: 'Missing blueprint_id' }, 400)
      const providers = await printifyFetch(`/catalog/blueprints/${blueprintId}/print_providers.json`, {}, apiKey)
      // Sort by shipping speed and rating — prefer US-based providers
      const sorted = (providers || []).sort((a, b) => {
        const aUS = (a.location?.country || '').includes('US') ? -1 : 1
        const bUS = (b.location?.country || '').includes('US') ? -1 : 1
        return aUS - bUS
      })
      return corsResponse({ provider: sorted[0] || null, all: sorted })
    }

    return corsResponse({ error: `Unknown action: ${action}` }, 400)

  } catch (err) {
    if (err instanceof Response) return err
    console.error('Printify error:', err.message)
    return corsResponse({ error: err.message }, 500)
  }
}

export const config = { path: '/api/printify' }
