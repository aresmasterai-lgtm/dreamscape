// src/lib/colorMap.js
// ─────────────────────────────────────────────────────────────────────────────
// Comprehensive color name → hex map covering every known Printful + Printify
// color name. Used by CreateProductModal and the Printify Netlify function.
//
// Sources:
//   - Printful catalog API (returns color_code hex directly)
//   - Printify catalog API (name-only, no hex — mapped here)
//   - Manual additions from crawl-colors.js output
// ─────────────────────────────────────────────────────────────────────────────

export const COLOR_MAP = {
  // ── Blacks & Charcoals ──────────────────────────────────────────────────────
  'black':                     '#111111',
  'jet black':                 '#111111',
  'vintage black':             '#1a1a1a',
  'black heather':             '#2c2c2c',
  'black melange':             '#2a2a2a',
  'charcoal':                  '#3b3b3b',
  'dark charcoal':             '#2d2d2d',
  'charcoal heather':          '#404040',
  'graphite heather':          '#4a4a4a',
  'graphite':                  '#444444',
  'slate':                     '#4a5568',
  'dark slate':                '#374151',
  'smoke':                     '#6b7280',

  // ── Whites & Creams ─────────────────────────────────────────────────────────
  'white':                     '#ffffff',
  'natural':                   '#faf3e0',
  'cream':                     '#fffbeb',
  'ivory':                     '#fffff0',
  'off white':                 '#f9f6ee',
  'light cream':               '#fefce8',
  'natural white':             '#fdf8f0',
  'bone':                      '#f5f0e1',

  // ── Greys ───────────────────────────────────────────────────────────────────
  'grey':                      '#9ca3af',
  'gray':                      '#9ca3af',
  'light grey':                '#d1d5db',
  'light gray':                '#d1d5db',
  'silver':                    '#c0c0c0',
  'silver grey':               '#c0c0c0',
  'sport grey':                '#a8a8a8',
  'sport gray':                '#a8a8a8',
  'heather grey':              '#a8adb8',
  'heather gray':              '#a8adb8',
  'athletic heather':          '#b0b5bc',
  'dark heather':              '#4b5563',
  'dark grey heather':         '#4b5563',
  'heather dark grey':         '#555b66',
  'storm grey':                '#6b7280',
  'gunmetal':                  '#4b5563',
  'ash':                       '#b8bcc8',
  'ash grey':                  '#b8bcc8',
  'pebble':                    '#9ca3af',
  'steel blue':                '#4682b4',
  'ice grey':                  '#e2e8f0',
  'dark grey':                 '#374151',
  'mid grey':                  '#6b7280',

  // ── Blues ───────────────────────────────────────────────────────────────────
  'navy':                      '#1b2a4a',
  'navy blue':                 '#1b2a4a',
  'dark navy':                 '#0f1d35',
  'navy heather':              '#2d3f6b',
  'navy blazer':               '#1b2959',
  'royal blue':                '#2563eb',
  'royal':                     '#2563eb',
  'true royal':                '#2563eb',
  'royal heather':             '#3b6fd4',
  'blue':                      '#3b82f6',
  'medium blue':               '#3b82f6',
  'carolina blue':             '#5eacdb',
  'carolina':                  '#5eacdb',
  'cornflower blue':           '#6495ed',
  'sky blue':                  '#87ceeb',
  'light blue':                '#93c5fd',
  'baby blue':                 '#bfdbfe',
  'powder blue':               '#b0d4f1',
  'columbia blue':             '#9bbfd9',
  'indigo blue':               '#4f46e5',
  'indigo':                    '#4f46e5',
  'cobalt':                    '#0047ab',
  'cobalt blue':               '#0047ab',
  'denim':                     '#1560bd',
  'ocean blue':                '#006994',
  'peacock':                   '#006d77',
  'airforce blue':             '#5d8aa8',
  'heather blue':              '#6b8dc4',
  'heather navy':              '#3a4f7a',
  'vintage blue':              '#4a6fa5',
  'midnight':                  '#191970',
  'midnight navy':             '#1a1f5e',
  'slate blue':                '#6a7ab5',
  'heather royal':             '#4070c8',
  'heather deep teal':         '#2a7a7a',

  // ── Greens ──────────────────────────────────────────────────────────────────
  'green':                     '#22c55e',
  'kelly green':               '#4caf50',
  'kelly':                     '#4caf50',
  'forest green':              '#166534',
  'forest':                    '#166534',
  'dark green':                '#15803d',
  'hunter green':              '#3a5a40',
  'hunter':                    '#3a5a40',
  'military green':            '#4b5320',
  'army green':                '#4b5320',
  'olive':                     '#6b7c27',
  'olive green':               '#6b7c27',
  'sage':                      '#87ae73',
  'sage green':                '#87ae73',
  'mint':                      '#a7f3d0',
  'mint green':                '#a7f3d0',
  'seafoam':                   '#71d4c0',
  'seafoam green':             '#71d4c0',
  'emerald':                   '#10b981',
  'jade':                      '#00a86b',
  'pine':                      '#1a4731',
  'moss':                      '#8a9a5b',
  'irish green':               '#009a44',
  'lime green':                '#84cc16',
  'lime':                      '#84cc16',
  'fern':                      '#4f7942',
  'heather green':             '#5a8c6a',
  'cypress':                   '#2d4a3e',
  'bottle green':              '#006a4e',
  'camo green':                '#78866b',
  'desert camo':               '#c3b091',
  'midnight green':            '#004953',

  // ── Reds ────────────────────────────────────────────────────────────────────
  'red':                       '#dc2626',
  'bright red':                '#dc2626',
  'cherry red':                '#9b1c1c',
  'dark red':                  '#7f1d1d',
  'deep red':                  '#991b1b',
  'burgundy':                  '#7f1d1d',
  'wine':                      '#722f37',
  'maroon':                    '#800000',
  'cardinal':                  '#c41e3a',
  'cardinal red':              '#c41e3a',
  'crimson':                   '#b91c1c',
  'fire red':                  '#ef4444',
  'scarlet':                   '#ff2400',
  'brick red':                 '#cb4154',
  'brick':                     '#cb4154',
  'garnet':                    '#7c1c2e',
  'ruby':                      '#9b111e',
  'tomato':                    '#ff6347',
  'heather red':               '#c45a5a',
  'vintage red':               '#b83232',
  'old gold':                  '#cfb53b',

  // ── Pinks & Roses ───────────────────────────────────────────────────────────
  'pink':                      '#ec4899',
  'light pink':                '#fbcfe8',
  'baby pink':                 '#f9a8d4',
  'soft pink':                 '#fda4af',
  'hot pink':                  '#db2777',
  'fuchsia':                   '#c026d3',
  'magenta':                   '#d946ef',
  'flamingo':                  '#fc8eac',
  'rose':                      '#f43f5e',
  'dark pink':                 '#be185d',
  'dusty rose':                '#c48b9f',
  'blush':                     '#de8fa8',
  'mauve':                     '#c28fa0',
  'orchid':                    '#da70d6',
  'heather radiant orchid':    '#9f5faa',
  'azalea':                    '#f4618c',
  'coral silk':                '#f08080',
  'heather maroon':            '#8b4057',
  'antique cherry red':        '#992233',

  // ── Oranges & Corals ────────────────────────────────────────────────────────
  'orange':                    '#f97316',
  'burnt orange':              '#c2400c',
  'dark orange':               '#ea580c',
  'safety orange':             '#ff6700',
  'coral':                     '#ff6b6b',
  'light coral':               '#f08080',
  'salmon':                    '#fa8072',
  'peach':                     '#ffcba4',
  'terra cotta':               '#c45c3c',
  'copper':                    '#b87333',
  'rust':                      '#b7410e',
  'amber':                     '#f59e0b',
  'heather orange':            '#e8845c',

  // ── Yellows & Golds ─────────────────────────────────────────────────────────
  'yellow':                    '#eab308',
  'bright yellow':             '#facc15',
  'lemon':                     '#fef08a',
  'lemon yellow':              '#fff44f',
  'gold':                      '#d97706',
  'antique gold':              '#b8860b',
  'mustard':                   '#ca8a04',
  'mustard yellow':            '#ca8a04',
  'sunflower':                 '#fbbf24',
  'banana':                    '#fef3c7',
  'butter':                    '#fef9c3',
  'heather yellow':            '#e5c35a',

  // ── Purples & Violets ───────────────────────────────────────────────────────
  'purple':                    '#7c3aed',
  'dark purple':               '#5b21b6',
  'light purple':              '#a78bfa',
  'lavender':                  '#c4b5fd',
  'violet':                    '#8b5cf6',
  'plum':                      '#6b21a8',
  'grape':                     '#6d2b7a',
  'berry':                     '#7b2d8b',
  'mulberry':                  '#7a3b6e',
  'iris':                      '#5a4fcf',
  'amethyst':                  '#9966cc',
  'lilac':                     '#c8a2c8',
  'heather purple':            '#7c5faa',
  'purple rush':               '#6f3c9e',
  'team purple':               '#5b2d8e',
  'cyber grape':               '#58427c',
  'midnight purple':           '#2d1b69',

  // ── Browns & Tans ───────────────────────────────────────────────────────────
  'brown':                     '#92400e',
  'dark brown':                '#713f12',
  'light brown':               '#a16207',
  'chocolate':                 '#3d1f00',
  'coffee':                    '#6f4e37',
  'mocha':                     '#967259',
  'tan':                       '#d2b48c',
  'camel':                     '#c19a6b',
  'khaki':                     '#c3b091',
  'sand':                      '#c2b280',
  'beige':                     '#f5f5dc',
  'taupe':                     '#b0a090',
  'sienna':                    '#a0522d',
  'chestnut':                  '#954535',
  'walnut':                    '#773f1a',
  'coyote brown':              '#81613c',
  'heather brown':             '#8c6a4a',

  // ── Teals & Cyans ───────────────────────────────────────────────────────────
  'teal':                      '#0d9488',
  'dark teal':                 '#0f766e',
  'heather teal':              '#2a9d8f',
  'turquoise':                 '#06b6d4',
  'aqua':                      '#22d3ee',
  'cyan':                      '#06b6d4',
  'deep teal':                 '#115e59',
  'caribbean blue':            '#00b4d8',
  'ocean':                     '#0077b6',
  'sapphire':                  '#0f52ba',
  'lagoon blue':               '#1ca9c9',

  // ── Special / Multi-tone ────────────────────────────────────────────────────
  'tie dye':                   '#8b5cf6',
  'rainbow':                   '#ec4899',
  'camo':                      '#78866b',
  'digital camo':              '#6d7c6a',
  'multicam':                  '#8b7355',
  'heather columbia blue':     '#7fb3d3',
  'heather cardinal':          '#c45a5a',
  'heather ice blue':          '#a8c8e8',
  'heather military green':    '#6b7a5a',
  'heather sapphire':          '#4a7ab5',
  'heather sport dark navy':   '#2d3f6b',
  'heather sport royal':       '#3d5fa0',
  'heather sport scarlet red': '#c45a5a',
  'heather sport dark green':  '#3a6b50',
  'vintage camo':              '#8b8060',
  'retro heather royal':       '#4a6faa',
  'soft cream':                '#fef9f0',
  'dark chocolate':            '#3d1a00',
  'neon green':                '#39ff14',
  'neon yellow':               '#ffff00',
  'neon pink':                 '#ff6ec7',
  'neon orange':               '#ff6700',
}

// ── Main lookup function ──────────────────────────────────────────────────────
// Returns the best hex match for a color name string.
// Falls back gracefully for unknown names.
export function getColorHex(name) {
  if (!name) return '#888888'
  const k = name.toLowerCase().trim()

  // Exact match
  if (COLOR_MAP[k]) return COLOR_MAP[k]

  // Partial match — find longest key that is a substring of the name
  let bestMatch = null
  let bestLen   = 0
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (k.includes(key) && key.length > bestLen) {
      bestMatch = hex
      bestLen   = key.length
    }
  }
  if (bestMatch) return bestMatch

  // Reverse partial — key contains the name
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (key.includes(k) && k.length > 2) return hex
  }

  return '#888888'
}

// ── Color display name cleanup ────────────────────────────────────────────────
// "HEATHER DARK NAVY" → "Heather Dark Navy"
export function formatColorName(name) {
  if (!name) return ''
  return name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ── Determine if a hex color needs white or dark text ─────────────────────────
export function textOnColor(hex) {
  if (!hex || hex === '#888888') return '#ffffff'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.5 ? '#000000' : '#ffffff'
}

// ── Group colors by family for better UX ─────────────────────────────────────
export function groupColorsByFamily(colors) {
  const families = {
    'Neutrals':  ['black', 'white', 'grey', 'gray', 'silver', 'charcoal', 'cream', 'natural', 'ash', 'heather'],
    'Blues':     ['blue', 'navy', 'royal', 'cobalt', 'indigo', 'sky', 'baby blue', 'carolina', 'denim', 'ocean'],
    'Greens':    ['green', 'forest', 'olive', 'sage', 'mint', 'teal', 'emerald', 'army', 'hunter', 'kelly'],
    'Reds':      ['red', 'crimson', 'scarlet', 'burgundy', 'maroon', 'wine', 'cardinal', 'cherry'],
    'Pinks':     ['pink', 'rose', 'flamingo', 'coral', 'blush', 'mauve', 'azalea', 'fuchsia', 'magenta'],
    'Purples':   ['purple', 'violet', 'lavender', 'plum', 'grape', 'berry', 'lilac', 'amethyst'],
    'Yellows':   ['yellow', 'gold', 'mustard', 'sunflower', 'amber', 'lemon', 'butter'],
    'Browns':    ['brown', 'tan', 'sand', 'beige', 'khaki', 'camel', 'mocha', 'chocolate', 'taupe'],
  }

  const grouped = {}
  const used    = new Set()

  for (const [family, keywords] of Object.entries(families)) {
    const matches = colors.filter(c => {
      if (used.has(c.name)) return false
      const n = c.name.toLowerCase()
      return keywords.some(kw => n.includes(kw))
    })
    if (matches.length > 0) {
      matches.forEach(c => used.add(c.name))
      grouped[family] = matches
    }
  }

  // Anything unmatched goes in "Other"
  const other = colors.filter(c => !used.has(c.name))
  if (other.length > 0) grouped['Other'] = other

  return grouped
}
