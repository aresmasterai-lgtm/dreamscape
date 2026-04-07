// netlify/functions/printify.js
// Handles all Printify API calls for Dreamscape

const PRINTIFY_API = 'https://api.printify.com/v1'
const API_KEY = process.env.PRINTIFY_API_KEY
const SHOP_ID = process.env.PRINTIFY_SHOP_ID

// Common color name → hex lookup (Printify doesn't return hex codes)
const COLOR_HEX = {
  'black': '#1a1a1a', 'white': '#ffffff', 'navy': '#1b2a4a', 'navy blue': '#1b2a4a',
  'royal blue': '#1a4fcc', 'blue': '#2563eb', 'light blue': '#93c5fd', 'baby blue': '#bfdbfe',
  'red': '#dc2626', 'burgundy': '#7f1d1d', 'maroon': '#7f1d1d', 'crimson': '#b91c1c',
  'green': '#16a34a', 'forest green': '#166534', 'military green': '#4a5c2a', 'sage': '#84a98c',
  'kelly green': '#15803d', 'mint': '#a7f3d0', 'olive': '#a16207',
  'grey': '#6b7280', 'gray': '#6b7280', 'light grey': '#d1d5db', 'dark grey': '#374151',
  'charcoal': '#374151', 'heather grey': '#9ca3af', 'sport grey': '#9ca3af',
  'yellow': '#eab308', 'gold': '#d97706', 'mustard': '#b45309',
  'orange': '#ea580c', 'coral': '#f87171', 'salmon': '#fca5a5',
  'pink': '#ec4899', 'light pink': '#fbcfe8', 'hot pink': '#db2777', 'fuchsia': '#c026d3',
  'purple': '#7c3aed', 'lavender': '#c4b5fd', 'violet': '#8b5cf6', 'plum': '#6b21a8',
  'brown': '#78350f', 'tan': '#d6b896', 'beige': '#e8d5b7', 'sand': '#d4c5a9',
  'cream': '#fef3c7', 'ivory': '#fffbeb', 'natural': '#fef3c7',
  'teal': '#0d9488', 'turquoise': '#06b6d4', 'cyan': '#22d3ee', 'aqua': '#06b6d4',
  'silver': '#94a3b8', 'ice grey': '#e2e8f0',
  'athletic heather': '#94a3b8', 'dark heather': '#4b5563',
  'tie dye': '#8b5cf6', 'camo': '#4a5c2a',
}

function getHex(colorName) {
  if (!colorName) return '#888888'
  const key = colorName.toLowerCase().trim()
  if (COLOR_HEX[key]) return COLOR_HEX[key]
  // Try partial match
  for (const [k, v] of Object.entries(COLOR_HEX)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return '#888888'
}

async function printifyFetch(path) {
  const res = await fetch(`${PRINTIFY_API}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Printify ${res.status}: ${text}`)
  }
  return res.json()
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers }
  }

  const params = event.queryStringParameters || {}
  const action = params.action

  try {
    // ── Catalog: paginated product browse ─────────────────────────────
    if (action === 'catalog') {
      const page = parseInt(params.page || '1')
      const limit = parseInt(params.limit || '40')
      const data = await printifyFetch(`/catalog/blueprints.json`)
      const blueprints = data || []

      // Filter out items Dreamscape doesn't support (embroidery, hats etc.)
      const SKIP_KW = ['embroidered', 'structured cap', 'dad hat', 'trucker hat', 'snapback', 'baseball cap', 'bucket hat', 'beanie']
      const filtered = blueprints.filter(b =>
        !SKIP_KW.some(kw => (b.title || '').toLowerCase().includes(kw))
      )

      const start = (page - 1) * limit
      const slice = filtered.slice(start, start + limit)

      const products = slice.map(b => ({
        id: `printify_${b.id}`,
        printify_id: b.id,
        provider: 'printify',
        title: b.title,
        model: b.title,
        image: b.images?.[0] || '',
        brand: b.brand,
        description: b.description || '',
      }))

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ products, total: filtered.length }),
      }
    }

    // ── Single blueprint with all variants / colors ───────────────────
    if (action === 'catalogProduct') {
      const rawId = params.id // e.g. "printify_5" or just "5"
      const blueprintId = rawId.replace('printify_', '')

      // Fetch blueprint info + print providers
      const [blueprint, providersData] = await Promise.all([
        printifyFetch(`/catalog/blueprints/${blueprintId}.json`),
        printifyFetch(`/catalog/blueprints/${blueprintId}/print_providers.json`),
      ])

      // Pick first print provider (usually the most popular one)
      const providers = providersData || []
      if (!providers.length) {
        return { statusCode: 200, headers, body: JSON.stringify({ variants: [], colors: [] }) }
      }
      const providerId = providers[0].id

      // Fetch variants for this blueprint + provider
      const variantData = await printifyFetch(
        `/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`
      )
      const variants = variantData?.variants || []

      // Build color map from Printify's option-based structure
      // Variant title is usually "Size / Color" or "Color / Size"
      const colorMap = {}
      for (const v of variants) {
        // Try to extract color from options array first
        let colorName = null
        if (v.options && Array.isArray(v.options)) {
          const colorOpt = v.options.find(o =>
            o.type?.toLowerCase() === 'color' ||
            o.title?.toLowerCase() === 'color' ||
            o.title?.toLowerCase() === 'colors'
          )
          colorName = colorOpt?.title || colorOpt?.value || null
        }
        // Fallback: parse from variant title ("XS / Black" → "Black")
        if (!colorName && v.title) {
          const parts = v.title.split('/')
          // Heuristic: color is usually the part that's not a size
          const SIZES = ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', 'one size']
          const nonSize = parts.find(p => !SIZES.includes(p.trim().toLowerCase()))
          colorName = nonSize?.trim() || parts[parts.length - 1]?.trim()
        }
        if (!colorName) colorName = 'Default'

        const hex = getHex(colorName)
        if (!colorMap[colorName]) {
          colorMap[colorName] = {
            name: colorName,
            hex,
            variantIds: [],
            image: blueprint.images?.[0] || '',
          }
        }
        colorMap[colorName].variantIds.push(v.id)
      }

      const colors = Object.values(colorMap)

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: `printify_${blueprintId}`,
          printify_id: blueprintId,
          provider: 'printify',
          title: blueprint.title,
          model: blueprint.title,
          image: blueprint.images?.[0] || '',
          brand: blueprint.brand,
          print_provider_id: providerId,
          variants,
          colors, // Pre-built color list
        }),
      }
    }

    // ── Create product in Printify store ──────────────────────────────
    if (action === 'createProduct' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const {
        blueprintId,
        printProviderId,
        title,
        description,
        variantIds,
        imageUrl,
        retail_price,
      } = body

      // 1. Upload image to Printify
      const uploadRes = await fetch(`${PRINTIFY_API}/uploads/images.json`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: 'artwork.png', url: imageUrl }),
      })
      const uploadData = await uploadRes.json()
      const imageId = uploadData.id
      if (!imageId) throw new Error('Printify image upload failed')

      // 2. Fetch variant details to build print_areas
      const variantData = await printifyFetch(
        `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`
      )
      const allVariants = variantData?.variants || []
      const selectedVariants = allVariants.filter(v => variantIds.includes(v.id))

      // Build variants array with retail price
      const productVariants = selectedVariants.map(v => ({
        id: v.id,
        price: Math.round(retail_price * 100), // Printify uses cents
        is_enabled: true,
      }))

      // Get placeholders from first variant
      const placeholders = selectedVariants[0]?.placeholders || [{ position: 'front', height: 1, width: 1 }]
      const printAreas = placeholders.map(p => ({
        variant_ids: variantIds,
        placeholders: [{
          position: p.position,
          images: [{
            id: imageId,
            x: 0.5, y: 0.5, scale: 1, angle: 0,
          }],
        }],
      }))

      // 3. Create product
      const createRes = await fetch(`${PRINTIFY_API}/shops/${SHOP_ID}/products.json`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          blueprint_id: blueprintId,
          print_provider_id: printProviderId,
          variants: productVariants,
          print_areas: printAreas,
        }),
      })
      const product = await createRes.json()
      if (product.errors || product.error) throw new Error(JSON.stringify(product.errors || product.error))

      // 4. Publish to Dreamscape channel
      await fetch(`${PRINTIFY_API}/shops/${SHOP_ID}/products/${product.id}/publish.json`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: true, description: true, images: true,
          variants: true, tags: true, keyFeatures: true, shipping_template: true,
        }),
      })

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ product_id: product.id, external_id: product.id }),
      }
    }

    // ── Mockup generation (best-effort, return blueprint image as fallback) ──
    if (action === 'mockup') {
      // Printify mockup API requires a published product — return null to
      // let the frontend fall back to the blueprint image for now
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ mockup_url: null }),
      }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }

  } catch (err) {
    console.error('[printify]', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
