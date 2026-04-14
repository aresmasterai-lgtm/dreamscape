// netlify/functions/printful.js
// Handles all Printful API calls for Dreamscape

const PRINTFUL_API = 'https://api.printful.com'
const API_KEY = process.env.PRINTFUL_API_KEY

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

async function pf(path, options = {}) {
  const res = await fetch(`${PRINTFUL_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Printful ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS }

  const params = event.queryStringParameters || {}
  const action = params.action

  try {

    // ── Catalog ───────────────────────────────────────────────────────────
    if (action === 'catalog') {
      const offset = parseInt(params.offset || '0')
      const data = await pf(`/products?limit=100&offset=${offset}`)
      const SKIP = ['embroidered','embroidery','structured cap','dad hat','trucker hat','snapback','baseball cap','bucket hat','beanie']
      const products = (data.result || [])
        .filter(p => !SKIP.some(kw => (p.model || '').toLowerCase().includes(kw)))
        .map(p => ({
          id: `pf_${p.id}`,
          provider: 'printful',
          raw_id: p.id,
          model: p.model || '',
          type: p.type || '',
          image: p.image || '',
        }))
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ products, paging: data.paging }) }
    }

    // ── Single product variants + colors ──────────────────────────────────
    if (action === 'catalogProduct') {
      const rawId = String(params.id || '').replace('pf_', '').replace('printful_', '')
      if (!rawId) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing id' }) }

      const data = await pf(`/products/${rawId}`)
      const product  = data.result?.product || {}
      const variants = data.result?.variants || []

      const hasColors = variants.some(v => v.color && v.color.trim())
      const variantMap = {}

      if (hasColors) {
        for (const v of variants) {
          const name = v.color || 'Default'
          if (!variantMap[name]) {
            variantMap[name] = {
              name,
              hex: v.color_code || v.color_code2 || '#888888',
              variantIds: [],
              image: v.image || product.image || '',
              isSize: false,
            }
          }
          variantMap[name].variantIds.push(v.id)
          if (v.image && !variantMap[name].image) variantMap[name].image = v.image
        }
      } else {
        // Size-based (canvas prints, posters, framed prints)
        for (const v of variants) {
          const name = v.size || v.name || `${v.id}`
          if (!variantMap[name]) {
            variantMap[name] = {
              name,
              hex: '#7C5CFC',
              variantIds: [],
              image: v.image || product.image || '',
              isSize: true,
            }
          }
          variantMap[name].variantIds.push(v.id)
        }
      }

      const colors = Object.values(variantMap)

      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({
          id: `pf_${rawId}`,
          raw_id: parseInt(rawId),
          provider: 'printful',
          model: product.model || '',
          image: product.image || '',
          variants,
          colors,
          isWallArt: !hasColors,
        }),
      }
    }

    // ── Create sync product ───────────────────────────────────────────────
    if (action === 'create' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const { title, description, variantIds, imageUrl } = body

      if (!variantIds?.length || !imageUrl) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing variantIds or imageUrl' }) }
      }

      const data = await pf('/store/products', {
        method: 'POST',
        body: JSON.stringify({
          sync_product: { name: title || 'Dreamscape Artwork' },
          sync_variants: variantIds.map(id => ({
            variant_id: id,
            files: [{ url: imageUrl }],
          })),
        }),
      })

      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({ id: data.result?.id, sync_product: data.result }),
      }
    }

    // ── Mockup create ─────────────────────────────────────────────────────
    if (action === 'mockupCreate' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const { catalogProductId, variantIds, imageUrl } = body
      const rawId = String(catalogProductId || '').replace('pf_', '').replace('printful_', '')

      const data = await pf(`/mockup-generator/create-task/${rawId}`, {
        method: 'POST',
        body: JSON.stringify({
          variant_ids: variantIds,
          files: [{
            placement: 'default',
            image_url: imageUrl,
            position: { area_width: 1800, area_height: 1800, width: 1800, height: 1800, top: 0, left: 0 },
          }],
        }),
      })

      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({ task_key: data.result?.task_key }),
      }
    }

    // ── Mockup status ─────────────────────────────────────────────────────
    if (action === 'mockupStatus') {
      const taskKey = params.taskKey
      if (!taskKey) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing taskKey' }) }

      const data = await pf(`/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`)
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({ status: data.result?.status, mockups: data.result?.mockups || [] }),
      }
    }

    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: `Unknown action: ${action}` }) }

  } catch (err) {
    console.error('[printful]', action, err.message)
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) }
  }
}
