export default async (req) => {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  const apiKey = process.env.PRINTFUL_API_KEY

  // Debug: confirm env var is present
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'PRINTFUL_API_KEY is not set in environment variables',
      debug: true
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-PF-Store-Id': process.env.PRINTFUL_STORE_ID || '',
  }

  try {
    // GET catalog products — uses the public catalog endpoint
    if (req.method === 'GET' && action === 'catalog') {
      const res = await fetch('https://api.printful.com/products', {
        method: 'GET',
        headers,
      })

      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        return new Response(JSON.stringify({
          error: 'Printful returned non-JSON response',
          raw: text.slice(0, 500),
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (!res.ok) {
        return new Response(JSON.stringify({
          error: data?.error?.message || data?.message || 'Printful API error',
          status: res.status,
          data,
        }), {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Filter to popular product types
      const popular = ['T-SHIRT', 'HOODIE', 'SWEATSHIRT', 'POSTER', 'MUG', 'PHONE', 'TOTE', 'HAT', 'JACKET', 'LEGGINGS']
      const filtered = (data.result || []).filter(p =>
        popular.some(type => (p.type || '').toUpperCase().includes(type))
      ).slice(0, 12)

      // If filter returns nothing, just return first 12
      const products = filtered.length > 0 ? filtered : (data.result || []).slice(0, 12)

      return new Response(JSON.stringify({ products }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // GET single product variants
    if (req.method === 'GET' && action === 'product') {
      const productId = url.searchParams.get('id')
      const res = await fetch(`https://api.printful.com/products/${productId}`, { headers })
      const data = await res.json()
      return new Response(JSON.stringify(data.result || data), {
        status: res.ok ? 200 : res.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // POST create store product
    if (req.method === 'POST' && action === 'create') {
      const body = await req.json()
      const { title, description, variantIds, imageUrl } = body

      const payload = {
        sync_product: {
          name: title,
          description: description || '',
        },
        sync_variants: variantIds.map(variantId => ({
          variant_id: variantId,
          retail_price: '35.00',
          files: [{
            url: imageUrl,
            position: 'front',
          }]
        }))
      }

      const res = await fetch('https://api.printful.com/store/products', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      return new Response(JSON.stringify(data.result || data), {
        status: res.ok ? 200 : res.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // GET store products
    if (req.method === 'GET' && action === 'store') {
      const res = await fetch('https://api.printful.com/store/products?limit=20', { headers })
      const data = await res.json()
      return new Response(JSON.stringify({ products: data.result || [] }), {
        status: res.ok ? 200 : res.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack?.slice(0, 300),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = {
  path: '/api/printful',
}
