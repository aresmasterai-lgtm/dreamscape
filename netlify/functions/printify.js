// netlify/functions/printify.js
// Handles all Printify API calls for Dreamscape

const PRINTIFY_API = 'https://api.printify.com/v1'
const API_KEY      = process.env.PRINTIFY_API_KEY
const SHOP_ID      = process.env.PRINTIFY_SHOP_ID

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

const COLOR_HEX = {
  'black':'#1a1a1a','white':'#ffffff','navy':'#1b2a4a','navy blue':'#1b2a4a',
  'royal blue':'#1a4fcc','blue':'#2563eb','light blue':'#93c5fd','baby blue':'#bfdbfe',
  'red':'#dc2626','burgundy':'#7f1d1d','maroon':'#7f1d1d','crimson':'#b91c1c',
  'green':'#16a34a','forest green':'#166534','military green':'#4a5c2a','sage':'#84a98c',
  'kelly green':'#15803d','mint':'#a7f3d0','olive':'#a16207',
  'grey':'#6b7280','gray':'#6b7280','light grey':'#d1d5db','dark grey':'#374151',
  'charcoal':'#374151','heather grey':'#9ca3af','sport grey':'#9ca3af',
  'yellow':'#eab308','gold':'#d97706','mustard':'#b45309',
  'orange':'#ea580c','coral':'#f87171','salmon':'#fca5a5',
  'pink':'#ec4899','light pink':'#fbcfe8','hot pink':'#db2777','fuchsia':'#c026d3',
  'purple':'#7c3aed','lavender':'#c4b5fd','violet':'#8b5cf6','plum':'#6b21a8',
  'brown':'#78350f','tan':'#d6b896','beige':'#e8d5b7','sand':'#d4c5a9',
  'cream':'#fef3c7','ivory':'#fffbeb','natural':'#fef3c7',
  'teal':'#0d9488','turquoise':'#06b6d4','cyan':'#22d3ee','aqua':'#06b6d4',
  'silver':'#94a3b8','ice grey':'#e2e8f0',
  'athletic heather':'#94a3b8','dark heather':'#4b5563',
  'tie dye':'#8b5cf6','camo':'#4a5c2a',
}

function getHex(name) {
  if (!name) return '#888888'
  const k = name.toLowerCase().trim()
  if (COLOR_HEX[k]) return COLOR_HEX[k]
  for (const [key, val] of Object.entries(COLOR_HEX)) {
    if (k.includes(key) || key.includes(k)) return val
  }
  return '#888888'
}

async function pyFetch(path, options = {}) {
  const res = await fetch(`${PRINTIFY_API}${path}`, {
    ...options,
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Printify ${res.status}: ${text.slice(0,200)}`)
  }
  return res.json()
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS }

  const params = event.queryStringParameters || {}
  const action = params.action

  try {

    // ── Single blueprint variants + colors ────────────────────────────────
    if (action === 'catalogProduct') {
      const rawId = String(params.id || '').replace('py_', '').replace('printify_', '')
      if (!rawId || isNaN(rawId)) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid blueprint id' }) }
      }

      const [blueprint, providersData] = await Promise.all([
        pyFetch(`/catalog/blueprints/${rawId}.json`),
        pyFetch(`/catalog/blueprints/${rawId}/print_providers.json`),
      ])

      const providers = providersData || []
      if (!providers.length) {
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ variants: [], colors: [] }) }
      }
      const providerId = providers[0].id

      const variantData = await pyFetch(`/catalog/blueprints/${rawId}/print_providers/${providerId}/variants.json`)
      const variants = variantData?.variants || []

      const SIZES = ['xs','s','m','l','xl','2xl','3xl','4xl','5xl','one size','os','6xl']
      const colorMap = {}
      for (const v of variants) {
        let colorName = null
        if (Array.isArray(v.options)) {
          const colorOpt = v.options.find(o =>
            (o.type || '').toLowerCase() === 'color' || (o.title || '').toLowerCase().includes('color')
          )
          colorName = colorOpt?.title || colorOpt?.value || null
        }
        if (!colorName && v.title) {
          const parts = v.title.split('/').map(s => s.trim())
          const nonSize = parts.find(p => !SIZES.includes(p.toLowerCase()))
          colorName = nonSize || parts[parts.length - 1]
        }
        if (!colorName) colorName = 'Default'
        if (!colorMap[colorName]) {
          colorMap[colorName] = { name: colorName, hex: getHex(colorName), variantIds: [], image: blueprint.images?.[0] || '' }
        }
        colorMap[colorName].variantIds.push(v.id)
      }

      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({
          id: `py_${rawId}`, raw_id: parseInt(rawId), provider: 'printify',
          title: blueprint.title, model: blueprint.title, image: blueprint.images?.[0] || '',
          brand: blueprint.brand, print_provider_id: providerId,
          variants, colors: Object.values(colorMap),
        }),
      }
    }

    // ── Create product ────────────────────────────────────────────────────
    if (action === 'create_product' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const { blueprint_id, print_provider_id, variants, image_url, title, description } = body

      const uploadData = await pyFetch('/uploads/images.json', {
        method: 'POST',
        body: JSON.stringify({ file_name: 'artwork.png', url: image_url }),
      })
      const imageId = uploadData.id
      if (!imageId) throw new Error('Printify image upload failed')

      const variantIds = variants.map(v => v.id)

      // Printify requires ALL variant IDs in print_areas — use a single
      // print_area covering all selected variants with front placement
      const printAreas = [{
        variant_ids: variantIds,
        placeholders: [{
          position: 'front',
          images: [{ id: imageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
        }],
      }]

      const res = await fetch(`${PRINTIFY_API}/shops/${SHOP_ID}/products.json`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'Dreamscape Artwork',
          description: description || '',
          blueprint_id, print_provider_id,
          variants: variants.map(v => ({ id: v.id, price: v.price, is_enabled: true })),
          print_areas: printAreas,
        }),
      })
      const product = await res.json()
      if (product.errors || product.error) throw new Error(JSON.stringify(product.errors || product.error))

      await fetch(`${PRINTIFY_API}/shops/${SHOP_ID}/products/${product.id}/publish.json`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
      })

      // Fetch generated mockup images (Printify generates them after publish)
      // Wait 3 seconds for Printify to process, then grab the first mockup image
      await new Promise(r => setTimeout(r, 3000))
      let mockup_url = null
      try {
        const productRes = await fetch(`${PRINTIFY_API}/shops/${SHOP_ID}/products/${product.id}.json`, {
          headers: { 'Authorization': `Bearer ${API_KEY}` },
        })
        const productData = await productRes.json()
        const images = productData.images || []
        // Prefer front/default position mockup
        const front = images.find(img => img.position === 'front' || img.is_default)
        mockup_url = front?.src || images[0]?.src || null
      } catch (e) {
        console.warn('[printify] mockup fetch failed:', e.message)
      }

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ product_id: product.id, mockup_url }) }
    }

    if (action === 'mockup') {
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ mockup_url: null }) }
    }

    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: `Unknown action: ${action}` }) }

  } catch (err) {
    console.error('[printify]', action, err.message)
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) }
  }
}
