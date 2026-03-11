export default async (req) => {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  const apiKey = process.env.PRINTFUL_API_KEY

  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'PRINTFUL_API_KEY is not set in environment variables',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const authHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  try {
    // GET catalog products
    if (req.method === 'GET' && action === 'catalog') {
      const res = await fetch('https://api.printful.com/products?limit=20', {
        method: 'GET',
        headers: authHeaders,
      })

      const data = await res.json()

      if (!res.ok) {
        return new Response(JSON.stringify({
          error: data?.error?.message || data?.message || 'Printful API error',
          status: res.status,
          raw: data,
        }), {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Return all products, no filtering
      const products = (data.result || []).slice(0, 20)

      return new Response(JSON.stringify({ products }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // GET single product variants
    if (req.method === 'GET' && action === 'product') {
      const productId = url.searchParams.get('id')
      const res = await fetch(`https://api.printful.com/products/${productId}`, { headers: authHeaders })
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
        headers: authHeaders,
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
      const res = await fetch('https://api.printful.com/store/products?limit=20', { headers: authHeaders })
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = {
  path: '/api/printful',
}
