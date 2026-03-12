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
    // GET stores (to find store ID)
    if (req.method === 'GET' && action === 'stores') {
      const res = await fetch(`${BASE}/stores`, { headers: authHeaders })
      const data = await res.json()
      return new Response(JSON.stringify(data), { status: res.ok ? 200 : res.status, headers: { 'Content-Type': 'application/json' } })
    }

    // GET catalog products (v2)
    if (req.method === 'GET' && action === 'catalog') {
      const res = await fetch(`${BASE}/v2/catalog/products?limit=20&selling_region_name=worldwide`, {
        headers: authHeaders,
      })
      const data = await res.json()

      if (!res.ok) {
        return new Response(JSON.stringify({ error: data?.error?.message || 'Printful API error', raw: data }), { status: res.status })
      }

      const products = (data.data || []).map(p => ({
        id: p.id,
        model: p.name,
        type: p.product_type || p.type_name || '',
        image: p.image || p.thumbnail_url || '',
        variants: p.variants || [],
      }))

      return new Response(JSON.stringify({ products }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // GET store products (v2)
    if (req.method === 'GET' && action === 'store') {
      const res = await fetch(`${BASE}/v2/sync/products?limit=20`, { headers: authHeaders })
      const data = await res.json()

      const products = (data.data || []).map(p => ({
        id: p.id,
        name: p.name,
        thumbnail_url: p.thumbnail_url || '',
        variants_count: p.variants_count || 0,
        variants: p.variants || [],
      }))

      return new Response(JSON.stringify({ products }), { status: res.ok ? 200 : res.status, headers: { 'Content-Type': 'application/json' } })
    }

    // GET single store product with variants + retail prices (v2)
    if (req.method === 'GET' && action === 'product') {
      const productId = url.searchParams.get('id')
      const res = await fetch(`${BASE}/v2/sync/products/${productId}`, { headers: authHeaders })
      const data = await res.json()
      return new Response(JSON.stringify(data.data || data), { status: res.ok ? 200 : res.status, headers: { 'Content-Type': 'application/json' } })
    }

    // POST create store product (v2)
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

      const res = await fetch(`${BASE}/v2/sync/products`, {
        method: 'POST', headers: authHeaders, body: JSON.stringify(payload),
      })
      const data = await res.json()
      return new Response(JSON.stringify(data.data || data), { status: res.ok ? 200 : res.status, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}

export const config = { path: '/api/printful' }

