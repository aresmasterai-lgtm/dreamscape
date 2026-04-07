#!/usr/bin/env node
// scripts/crawl-colors.js
// ─────────────────────────────────────────────────────────────────────────────
// Run this locally to crawl both Printful + Printify catalogs and output:
//   1. Every unique color name found across all products
//   2. Any color names NOT in our colorMap.js (so we can add them)
//   3. A ready-to-paste JS snippet for any missing colors
//
// Usage:
//   PRINTFUL_API_KEY=xxx PRINTIFY_API_KEY=yyy PRINTIFY_SHOP_ID=zzz node scripts/crawl-colors.js
//
// Output goes to scripts/color-crawl-output.json and prints a summary.
// ─────────────────────────────────────────────────────────────────────────────

import { COLOR_MAP } from '../src/lib/colorMap.js'
import fs from 'fs'

const PRINTFUL_KEY  = process.env.PRINTFUL_API_KEY
const PRINTIFY_KEY  = process.env.PRINTIFY_API_KEY
const PRINTIFY_SHOP = process.env.PRINTIFY_SHOP_ID

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── Printful crawl ────────────────────────────────────────────────────────────
async function crawlPrintful() {
  console.log('\n🔵 Crawling Printful catalog...')
  const colorNames = new Set()
  const colorHexMap = {} // name → hex (Printful provides hex directly)

  try {
    // Fetch all catalog products
    let offset = 0
    let products = []
    while (true) {
      const res  = await fetch(`https://api.printful.com/products?offset=${offset}&limit=100`, {
        headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` }
      })
      const data = await res.json()
      const items = data.result || []
      if (!items.length) break
      products.push(...items)
      if (items.length < 100) break
      offset += 100
      await sleep(200)
    }
    console.log(`  Found ${products.length} Printful products`)

    // Sample first 30 products for variants (full crawl takes too long)
    const sample = products.slice(0, 30)
    for (const p of sample) {
      try {
        const vRes = await fetch(`https://api.printful.com/products/${p.id}`, {
          headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` }
        })
        const vData = await vRes.json()
        const variants = vData.result?.variants || []
        for (const v of variants) {
          if (v.color) {
            const name = v.color.toLowerCase().trim()
            colorNames.add(name)
            if (v.color_code && !colorHexMap[name]) {
              colorHexMap[name] = v.color_code
            }
          }
        }
        await sleep(100)
      } catch (e) {
        console.warn(`  Skipping product ${p.id}: ${e.message}`)
      }
    }
  } catch (e) {
    console.error('Printful crawl failed:', e.message)
  }

  return { colorNames: [...colorNames], colorHexMap }
}

// ── Printify crawl ────────────────────────────────────────────────────────────
async function crawlPrintify() {
  console.log('\n🟢 Crawling Printify catalog...')
  const colorNames = new Set()
  const SIZES = ['xs','s','m','l','xl','2xl','3xl','4xl','5xl','one size','os','6xl']

  try {
    const res  = await fetch('https://api.printify.com/v1/catalog/blueprints.json', {
      headers: { 'Authorization': `Bearer ${PRINTIFY_KEY}` }
    })
    const blueprints = await res.json()
    console.log(`  Found ${blueprints.length} Printify blueprints`)

    // Sample first 40 blueprints
    const sample = blueprints.slice(0, 40)
    for (const bp of sample) {
      try {
        const providers = await fetch(`https://api.printify.com/v1/catalog/blueprints/${bp.id}/print_providers.json`, {
          headers: { 'Authorization': `Bearer ${PRINTIFY_KEY}` }
        }).then(r => r.json())

        if (!providers?.length) continue
        const providerId = providers[0].id

        const variantData = await fetch(
          `https://api.printify.com/v1/catalog/blueprints/${bp.id}/print_providers/${providerId}/variants.json`,
          { headers: { 'Authorization': `Bearer ${PRINTIFY_KEY}` } }
        ).then(r => r.json())

        const variants = variantData?.variants || []
        for (const v of variants) {
          // Extract color from options array
          if (Array.isArray(v.options)) {
            const colorOpt = v.options.find(o =>
              (o.type || '').toLowerCase() === 'color' ||
              (o.title || '').toLowerCase().includes('color')
            )
            if (colorOpt?.title) {
              colorNames.add(colorOpt.title.toLowerCase().trim())
            }
          }
          // Parse from title "XS / Black" → "Black"
          if (v.title) {
            const parts = v.title.split('/').map(s => s.trim())
            const nonSize = parts.find(p => !SIZES.includes(p.toLowerCase()))
            if (nonSize) colorNames.add(nonSize.toLowerCase().trim())
          }
        }
        await sleep(150)
      } catch (e) {
        console.warn(`  Skipping blueprint ${bp.id}: ${e.message}`)
      }
    }
  } catch (e) {
    console.error('Printify crawl failed:', e.message)
  }

  return { colorNames: [...colorNames] }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎨 Dreamscape Color Crawler')
  console.log('════════════════════════════')

  const [printful, printify] = await Promise.all([
    PRINTFUL_KEY ? crawlPrintful() : Promise.resolve({ colorNames: [], colorHexMap: {} }),
    PRINTIFY_KEY ? crawlPrintify() : Promise.resolve({ colorNames: [] }),
  ])

  // Merge all discovered color names
  const allNames = new Set([
    ...printful.colorNames,
    ...printify.colorNames,
  ])

  // Find names NOT in our color map
  const knownKeys = new Set(Object.keys(COLOR_MAP))
  const missing   = []
  const covered   = []

  for (const name of allNames) {
    const k = name.toLowerCase().trim()
    // Check exact + partial match
    const exactMatch    = knownKeys.has(k)
    const partialMatch  = !exactMatch && [...knownKeys].some(key => k.includes(key) || key.includes(k))
    const printfulHex   = printful.colorHexMap?.[k]

    if (exactMatch || partialMatch) {
      covered.push(name)
    } else {
      missing.push({ name, hex: printfulHex || null })
    }
  }

  // Sort missing by name
  missing.sort((a, b) => a.name.localeCompare(b.name))

  console.log('\n📊 Results:')
  console.log(`  Total unique colors found: ${allNames.size}`)
  console.log(`  Already covered in colorMap: ${covered.length}`)
  console.log(`  Missing from colorMap: ${missing.length}`)

  if (missing.length > 0) {
    console.log('\n⚠️  Missing colors (add these to src/lib/colorMap.js):')
    console.log('────────────────────────────────────────────────────')

    // Generate ready-to-paste JS
    let snippet = '// ADD THESE TO COLOR_MAP in src/lib/colorMap.js:\n'
    for (const { name, hex } of missing) {
      const hexVal = hex || '#888888  // ← needs real hex'
      snippet += `  '${name}': '${hexVal}',\n`
    }
    console.log(snippet)

    // Write output file
    const output = {
      crawledAt: new Date().toISOString(),
      totalFound: allNames.size,
      covered: covered.sort(),
      missing: missing,
      printfulHexMap: printful.colorHexMap,
      snippet,
    }
    fs.writeFileSync('scripts/color-crawl-output.json', JSON.stringify(output, null, 2))
    console.log('\n✅ Full output written to scripts/color-crawl-output.json')
  } else {
    console.log('\n✅ All colors are covered in colorMap.js!')
  }

  // Also output Printful hex map (these are ground truth)
  if (Object.keys(printful.colorHexMap).length > 0) {
    console.log(`\n🔵 Printful provided ${Object.keys(printful.colorHexMap).length} hex values directly`)
    console.log('  These override our map at runtime (see CreateProductModal)')
  }
}

main().catch(console.error)
