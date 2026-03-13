export default async (req) => {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

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

    // GET single catalog product with variants
    if (req.method === 'GET' && action === 'catalogProduct') {
      const productId = url.searchParams.get('id')
      const res = await fetch(`${BASE}/products/${productId}`, { headers: authHeaders })
      const data = await res.json()
      return new Response(JSON.stringify(data.result || data), {
        status: res.ok ? 200 : res.status, headers: { 'Content-Type': 'application/json' },
      })
    }

    // POST create store product
    if (req.method === 'POST' && action === 'create') {
      const body = await req.json()
      const { title, description, variantIds, imageUrl } = body

      const payload = {
        sync_product: { name: title, description: description || '' },
        sync_variants: variantIds.map(variantId => ({
          variant_id: variantId,
          retail_price: '35.00',
          files: [{ url: imageUrl, position: 'front' }],
        })),
      }

      const res = await fetch(`${BASE}/store/products`, {
        method: 'POST', headers: authHeaders, body: JSON.stringify(payload),
      })
      const data = await res.json()
      return new Response(JSON.stringify(data.result || data), {
        status: res.ok ? 200 : res.status, headers: { 'Content-Type': 'application/json' },
      })
    }

    // POST create mockup generation task
    // Printful mockup generator: POST /mockup-generator/create-task/{catalog_product_id}
    if (req.method === 'POST' && action === 'mockupCreate') {
      const body = await req.json()
      const { catalogProductId, variantIds, imageUrl } = body

      const payload = {
        variant_ids: variantIds.slice(0, 3), // Use first 3 variants for preview
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
    // Poll: GET /mockup-generator/task?task_key={taskKey}
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

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}

export const config = { path: '/api/printful' }
