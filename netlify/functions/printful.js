import { requireAuthLight, checkRateLimit, corsResponse, optionsResponse } from './auth-middleware.js'

export default async (req) => {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (req.method === 'OPTIONS') return optionsResponse()

  // Verify auth on every request
  let authUser
  try {
    const result = await requireAuthLight(req)
    authUser = result.user
  } catch (authErr) { return authErr }

  // Rate limit: 60 calls/min per user
  if (!checkRateLimit(`printful:${authUser.id}`, 60)) {
    return corsResponse({ error: 'Too many requests' }, 429)
  }

  const apiKey = process.env.PRINTFUL_API_KEY

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'PRINTFUL_API_KEY is not set' }), { status: 500 })
  }

  const authHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-PF-Store-Id': process.env.PRINTFUL_STORE_ID || '',
  }

  const BASE = 'https://api.printful.com'

  try {
    // GET stores list
    if (req.method === 'GET' && action === 'stores') {
      const res = await fetch(`${BASE}/stores`, { headers: authHeaders })
      const data = await res.json()
      return new Response(JSON.stringify(data), {
        status: res.ok ? 200 : res.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // GET catalog products
    if (req.method === 'GET' && action === 'catalog') {
      const offset = parseInt(url.searchParams.get('offset') || '0')
      const res = await fetch(`${BASE}/products?limit=100&offset=${offset}`, { headers: authHeaders })
      const data = await res.json()
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data?.error?.message || 'Printful API error', raw: data }), {
          status: res.status, headers: { 'Content-Type': 'application/json' },
        })
      }
      const products = (data.result || []).map(p => ({
        id: p.id, model: p.model, type: p.type, image: p.image, variants: p.variants || [],
      }))
      return new Response(JSON.stringify({ products, paging: data.paging || {} }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }

    // GET store products
    if (req.method === 'GET' && action === 'store') {
      const res = await fetch(`${BASE}/store/products?limit=20`, { headers: authHeaders })
      const data = await res.json()
      const products = (data.result || []).map(p => ({
        id: p.id, name: p.name, thumbnail_url: p.thumbnail_url || '',
        variants_count: p.variants_count || 0, variants: p.variants || [],
      }))
      return new Response(JSON.stringify({ products }), {
        status: res.ok ? 200 : res.status, headers: { 'Content-Type': 'application/json' },
      })
    }

    // GET single store product
    if (req.method === 'GET' && action === 'product') {
      const productId = url.searchParams.get('id')
      const res = await fetch(`${BASE}/store/products/${productId}`, { headers: authHeaders })
      const data = await res.json()
      return new Response(JSON.stringify(data.result || data), {
        status: res.ok ? 200 : res.status, headers: { 'Content-Type': 'application/json' },
      })
    }

    // GET single catalog product with variants (includes price = wholesale cost per variant)
    if (req.method === 'GET' && action === 'catalogProduct') {
      const productId = url.searchParams.get('id')
      const res = await fetch(`${BASE}/products/${productId}`, { headers: authHeaders })
      const data = await res.json()
      const result = data.result || data

      // Ensure price field is always surfaced clearly on each variant
      if (result.variants) {
        result.variants = result.variants.map(v => ({
          ...v,
          // `price` is Printful's wholesale cost — what you pay per item ordered
          // Explicitly surface it so frontend always has a clear field to read
          wholesale_cost: parseFloat(v.price) || null,
        }))
      }

      return new Response(JSON.stringify(result), {
        status: res.ok ? 200 : res.status, headers: { 'Content-Type': 'application/json' },
      })
    }

    // GET pricing summary for a catalog product
    // Returns: lowestCost, averageCost, hasFullPricing, variants with costs
    if (req.method === 'GET' && action === 'catalogPricing') {
      const productId = url.searchParams.get('id')
      if (!productId) {
        return new Response(JSON.stringify({ error: 'id is required' }), { status: 400 })
      }
      const res = await fetch(`${BASE}/products/${productId}`, { headers: authHeaders })
      const data = await res.json()
      const variants = data.result?.variants || []

      const prices = variants
        .map(v => parseFloat(v.price))
        .filter(n => !isNaN(n) && n > 0)

      if (prices.length === 0) {
        return new Response(JSON.stringify({
          productId,
          hasFullPricing: false,
          lowestCost: null,
          averageCost: null,
          variantCount: variants.length,
          pricedVariantCount: 0,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      return new Response(JSON.stringify({
        productId,
        hasFullPricing: prices.length === variants.length,
        pricedVariantCount: prices.length,
        variantCount: variants.length,
        lowestCost: Math.min(...prices),
        averageCost: parseFloat((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)),
        highestCost: Math.max(...prices),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // POST create store product
    // FIX: use the actual retailPrice passed from the frontend, not a hardcoded $35.00
    if (req.method === 'POST' && action === 'create') {
      const body = await req.json()
      const { title, description, variantIds, imageUrl, retailPrice,
              originalArtworkId, originalArtistId, artistRoyaltyPct } = body
      // SECURITY: always use verified user id, never trust client-provided userId
      const verifiedUserId = authUser.id

      // retailPrice should always be provided from the frontend pricing calculator
      // Fall back to 35.00 only as a last resort — frontend enforces minimum profit
      const priceToUse = retailPrice && parseFloat(retailPrice) > 0
        ? parseFloat(retailPrice).toFixed(2)
        : '35.00'

      const payload = {
        sync_product: { name: title, description: description || '' },
        sync_variants: variantIds.map(variantId => ({
          variant_id: variantId,
          retail_price: priceToUse,
          files: [{ url: imageUrl, position: 'front' }],
        })),
      }

      const res = await fetch(`${BASE}/store/products`, {
        method: 'POST', headers: authHeaders, body: JSON.stringify(payload),
      })
      const data = await res.json()
      // Return attribution data alongside Printful result so frontend can store it
      const result = data.result || data
      if (originalArtworkId) result._attribution = { originalArtworkId, originalArtistId, artistRoyaltyPct: artistRoyaltyPct || 0 }
      return new Response(JSON.stringify(result), {
        status: res.ok ? 200 : res.status, headers: { 'Content-Type': 'application/json' },
      })
    }

    // POST create mockup generation task
    if (req.method === 'POST' && action === 'mockupCreate') {
      const body = await req.json()
      const { catalogProductId, variantIds, imageUrl } = body

      const payload = {
        variant_ids: variantIds.slice(0, 3),
        format: 'jpg',
        files: [{
          placement: 'front',
          image_url: imageUrl,
          position: {
            area_width: 1800,
            area_height: 2400,
            width: 1800,
            height: 1800,
            top: 300,
            left: 0,
          },
        }],
      }

      const res = await fetch(`${BASE}/mockup-generator/create-task/${catalogProductId}`, {
        method: 'POST', headers: authHeaders, body: JSON.stringify(payload),
      })
      const data = await res.json()
      return new Response(JSON.stringify(data.result || data), {
        status: res.ok ? 200 : res.status, headers: { 'Content-Type': 'application/json' },
      })
    }

    // GET mockup task status
    if (req.method === 'GET' && action === 'mockupStatus') {
      const taskKey = url.searchParams.get('taskKey')
      if (!taskKey) {
        return new Response(JSON.stringify({ error: 'taskKey is required' }), { status: 400 })
      }
      const res = await fetch(`${BASE}/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`, {
        headers: authHeaders,
      })
      const data = await res.json()
      return new Response(JSON.stringify(data.result || data), {
        status: res.ok ? 200 : res.status, headers: { 'Content-Type': 'application/json' },
      })
    }

    // POST update retail price on existing Printful store variants
    // Called when a creator edits their product price in Dreamscape
    if (req.method === 'POST' && action === 'updateVariantPrice') {
      const body = await req.json()
      const { variantIds, retailPrice } = body
      if (!variantIds?.length || !retailPrice) {
        return new Response(JSON.stringify({ error: 'variantIds and retailPrice required' }), { status: 400 })
      }
      // Update each variant's retail_price on Printful
      const results = await Promise.all(
        variantIds.map(async (variantId) => {
          const res = await fetch(`${BASE}/store/variants/${variantId}`, {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify({ retail_price: String(retailPrice) }),
          })
          const data = await res.json()
          return { variantId, ok: res.ok, result: data.result || data }
        })
      )
      const allOk = results.every(r => r.ok)
      return new Response(JSON.stringify({ success: allOk, results }), {
        status: allOk ? 200 : 207,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}

export const config = { path: '/api/printful' }
