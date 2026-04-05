/**
 * Unified catalog endpoint — merges Printful + Printify products
 * into one normalized shape so the frontend never knows which provider
 * is fulfilling a given product.
 *
 * Normalized product shape:
 * {
 *   id:          string  — "pf_123" | "py_456"
 *   provider:    "printful" | "printify"
 *   model:       string  — display name
 *   type:        string  — product type/category
 *   image:       string  — thumbnail URL
 *   base_cost:   number  — estimated base cost USD
 *   tags:        string[]
 * }
 */
import { corsResponse, optionsResponse } from './auth-middleware.js'

const PRINTFUL_BASE  = 'https://api.printful.com'
const PRINTIFY_BASE  = 'https://api.printify.com/v1'

// Products to exclude — don't print well with AI artwork
const SKIP_KEYWORDS = [
  'embroidered','embroidery','structured cap','snapback','baseball cap',
  'bucket hat','trucker hat','dad hat','socks','underwear','leggings',
  'swimwear','mask','apron','dog','pet','puzzle','calendar','notebook',
  'journal','towel','bath','shower','face mask'
]

function shouldSkip(name = '') {
  const n = name.toLowerCase()
  return SKIP_KEYWORDS.some(kw => n.includes(kw))
}

// ── Printful catalog fetch (all pages) ───────────────────────
async function fetchPrintfulCatalog(apiKey) {
  let all = []
  let offset = 0
  const limit = 100
  try {
    while (true) {
      const res = await fetch(`${PRINTFUL_BASE}/products?limit=${limit}&offset=${offset}`, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) break
      const data = await res.json()
      const page = data.result || []
      all = all.concat(page)
      const total = data.paging?.total || 0
      offset += limit
      if (offset >= total || page.length < limit) break
    }
  } catch (err) {
    console.warn('Printful catalog fetch error:', err.message)
  }

  return all
    .filter(p => !shouldSkip(p.model))
    .map(p => ({
      id:        `pf_${p.id}`,
      provider:  'printful',
      raw_id:    p.id,
      model:     p.model || '',
      type:      p.type  || '',
      image:     p.image || '',
      base_cost: null, // fetched on product select
      tags:      [],
    }))
}

// ── Printify blueprint fetch ─────────────────────────────────
async function fetchPrintifyCatalog(apiKey) {
  try {
    const res = await fetch(`${PRINTIFY_BASE}/catalog/blueprints.json`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const blueprints = await res.json()

    return (blueprints || [])
      .filter(b => !shouldSkip(b.title))
      .map(b => ({
        id:        `py_${b.id}`,
        provider:  'printify',
        raw_id:    b.id,
        model:     b.title || '',
        type:      b.brand || b.model || '',
        image:     b.images?.[0] || '',
        base_cost: null,
        tags:      b.tags || [],
      }))
  } catch (err) {
    console.warn('Printify catalog fetch error:', err.message)
    return []
  }
}

// ── Deduplicate — remove near-identical products ─────────────
// e.g. Printful "Unisex Jersey T-Shirt" & Printify "Bella+Canvas 3001"
// We keep BOTH but prefer Printify for lower base costs on common items
function deduplicateAndSort(products) {
  // Sort: Printify first (better prices), then Printful
  // Wall art / canvas / premium products: prefer Printful (better quality)
  const PRINTFUL_PREFERRED = ['canvas','framed','metal','acrylic','wood print','poster hanger']
  const PRINTIFY_PREFERRED = ['t-shirt','tee','hoodie','sweatshirt','mug','phone case','tote','pillow','blanket']

  return products.sort((a, b) => {
    const aModel = a.model.toLowerCase()
    const bModel = b.model.toLowerCase()

    // Wall art → Printful first
    const aPFPref = PRINTFUL_PREFERRED.some(k => aModel.includes(k))
    const bPFPref = PRINTFUL_PREFERRED.some(k => bModel.includes(k))
    if (aPFPref && a.provider === 'printful') return -1
    if (bPFPref && b.provider === 'printful') return 1

    // Common apparel → Printify first
    const aPYPref = PRINTIFY_PREFERRED.some(k => aModel.includes(k))
    const bPYPref = PRINTIFY_PREFERRED.some(k => bModel.includes(k))
    if (aPYPref && a.provider === 'printify') return -1
    if (bPYPref && b.provider === 'printify') return 1

    return a.model.localeCompare(b.model)
  })
}

// ── Main handler ─────────────────────────────────────────────
export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  const printfulKey  = process.env.PRINTFUL_API_KEY
  const printifyKey  = process.env.PRINTIFY_API_KEY

  try {
    // Fetch both catalogs in parallel
    const [printfulProducts, printifyProducts] = await Promise.all([
      printfulKey  ? fetchPrintfulCatalog(printfulKey)   : [],
      printifyKey  ? fetchPrintifyCatalog(printifyKey)   : [],
    ])

    const all = deduplicateAndSort([...printfulProducts, ...printifyProducts])

    return corsResponse({
      products: all,
      total:    all.length,
      sources: {
        printful:  printfulProducts.length,
        printify:  printifyProducts.length,
      }
    })
  } catch (err) {
    console.error('Catalog error:', err.message)
    return corsResponse({ error: err.message }, 500)
  }
}

export const config = { path: '/api/catalog' }
