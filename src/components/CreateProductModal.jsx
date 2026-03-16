import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TIER_LIMITS = {
  free:    { products: 3  },
  starter: { products: 15 },
  pro:     { products: 50 },
  studio:  { products: Infinity },
}

async function checkProductLimit(userId, tier) {
  if (tier === 'studio') return { allowed: true, used: 0, limit: Infinity }
  const limit = TIER_LIMITS[tier]?.products || 3
  const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  return { allowed: (count || 0) < limit, used: count || 0, limit }
}

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494', red: '#FF4D4D',
}

function Spinner({ label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 0' }}>
      <style>{`@keyframes cpulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'cpulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
      </div>
      {label && <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{label}</p>}
    </div>
  )
}

// ── Art Placement Editor ──────────────────────────────────────
function ArtPlacementEditor({ artworkUrl, productImage, productName, onPlacementChange }) {
  const canvasRef = useRef(null)
  const [artPos, setArtPos] = useState({ x: 25, y: 20, scale: 50 }) // % based
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const containerRef = useRef(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    // Draw product image
    const prodImg = new Image()
    prodImg.crossOrigin = 'anonymous'
    prodImg.onload = () => {
      ctx.drawImage(prodImg, 0, 0, W, H)

      // Draw artwork on top
      const artImg = new Image()
      artImg.crossOrigin = 'anonymous'
      artImg.onload = () => {
        const artW = (artPos.scale / 100) * W
        const artH = artW * (artImg.height / artImg.width)
        const artX = (artPos.x / 100) * W - artW / 2
        const artY = (artPos.y / 100) * H - artH / 2
        ctx.globalAlpha = 0.92
        ctx.drawImage(artImg, artX, artY, artW, artH)
        ctx.globalAlpha = 1

        // Draw selection border
        ctx.strokeStyle = C.accent
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.strokeRect(artX - 2, artY - 2, artW + 4, artH + 4)
        ctx.setLineDash([])

        // Draw handle corners
        const corners = [[artX, artY], [artX + artW, artY], [artX, artY + artH], [artX + artW, artY + artH]]
        corners.forEach(([cx, cy]) => {
          ctx.fillStyle = C.accent
          ctx.fillRect(cx - 5, cy - 5, 10, 10)
        })

        onPlacementChange?.({ x: artPos.x, y: artPos.y, scale: artPos.scale, artW, artH, artX, artY, canvasW: W, canvasH: H })
      }
      artImg.src = artworkUrl
    }
    prodImg.src = productImage || '/placeholder-shirt.png'
  }, [artPos, artworkUrl, productImage])

  useEffect(() => { draw() }, [draw])

  const getRelativePos = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 50, y: 50 }
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    }
  }

  const handleMouseDown = (e) => {
    e.preventDefault()
    const pos = getRelativePos(e)
    setDragging(true)
    setDragStart({ mouseX: pos.x, mouseY: pos.y, artX: artPos.x, artY: artPos.y })
  }

  const handleMouseMove = (e) => {
    if (!dragging || !dragStart) return
    e.preventDefault()
    const pos = getRelativePos(e)
    const newX = Math.max(5, Math.min(95, dragStart.artX + (pos.x - dragStart.mouseX)))
    const newY = Math.max(5, Math.min(95, dragStart.artY + (pos.y - dragStart.mouseY)))
    setArtPos(prev => ({ ...prev, x: newX, y: newY }))
  }

  const handleMouseUp = () => { setDragging(false); setDragStart(null) }

  return (
    <div ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={400}
        height={480}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        style={{ width: '100%', height: 'auto', borderRadius: 12, cursor: dragging ? 'grabbing' : 'grab', border: `1px solid ${C.border}`, background: '#f5f5f5', display: 'block' }}
      />
      {/* Scale slider */}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>Size</span>
        <input type="range" min="10" max="90" value={artPos.scale}
          onChange={e => setArtPos(prev => ({ ...prev, scale: parseInt(e.target.value) }))}
          style={{ flex: 1, accentColor: C.accent }} />
        <span style={{ fontSize: 11, color: C.text, minWidth: 32 }}>{artPos.scale}%</span>
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['Center', 50, 35], ['Top', 50, 20], ['Large', 50, 35]].map(([label, x, y]) => (
          <button key={label} onClick={() => setArtPos(prev => ({ ...prev, x, y, scale: label === 'Large' ? 70 : 50 }))}
            style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
        <button onClick={() => setArtPos({ x: 50, y: 35, scale: 50 })}
          style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>
          Reset
        </button>
      </div>
      <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Drag your artwork to position it · Use slider to resize</p>
    </div>
  )
}


// ── Printful Fallback Base Costs ──────────────────────────────
// Used when the API returns no pricing for a product type.
// Values are approximate 2025 Printful wholesale costs in USD.
// Source: https://www.printful.com/custom — checked March 2026.
// Update these periodically as Printful pricing changes.
const FALLBACK_COSTS = {
  'T-SHIRT':      12.95,
  'SHIRT':        12.95,
  'HOODIE':       27.95,
  'SWEATSHIRT':   24.95,
  'LONG SLEEVE':  17.95,
  'CROP TOP':     15.95,
  'TANK TOP':     12.95,
  'POLO':         19.95,
  'DRESS':        22.95,
  'LEGGINGS':     21.95,
  'SHORTS':       18.95,
  'JOGGERS':      24.95,
  'JACKET':       34.95,
  'BOMBER':       38.95,
  'VEST':         28.95,
  'MUG':           8.95,
  'TRAVEL MUG':   16.95,
  'BOTTLE':       18.95,
  'GLASS':        11.95,
  'POSTER':        9.95,
  'CANVAS':       18.95,
  'FRAME':        24.95,
  'PRINT':         9.95,
  'PHONE CASE':   11.95,
  'TOTE':         12.95,
  'BAG':          14.95,
  'BACKPACK':     29.95,
  'PILLOW':       17.95,
  'BLANKET':      34.95,
  'TOWEL':        21.95,
  'SOCKS':        10.95,
  'HAT':          17.95,
  'CAP':          17.95,
  'BEANIE':       15.95,
  'APRON':        19.95,
  'NOTEBOOK':     12.95,
  'STICKER':       2.95,
  'FACE MASK':     9.95,
  'PATCH':         6.95,
}

// Get base cost — live from API first, fallback table second, null if unknown
function resolveBaseCost(apiCost, productType) {
  if (apiCost != null && apiCost > 0) return apiCost
  if (!productType) return null
  const upper = productType.toUpperCase()
  for (const [key, cost] of Object.entries(FALLBACK_COSTS)) {
    if (upper.includes(key)) return cost
  }
  return null
}

// ── Pricing Calculator ─────────────────────────────────────────
const DREAMSCAPE_FEE_PCT = 0.10
const STRIPE_PCT         = 0.029
const STRIPE_FIXED       = 0.30

function calcEarnings(retailPrice, baseCost) {
  const retail = parseFloat(retailPrice) || 0
  if (retail <= 0 || baseCost == null) return null
  const stripeFee     = retail * STRIPE_PCT + STRIPE_FIXED
  const dreamscapeFee = retail * DREAMSCAPE_FEE_PCT
  const earnings      = retail - baseCost - stripeFee - dreamscapeFee
  const margin        = (earnings / retail) * 100
  const breakEven     = (baseCost + STRIPE_FIXED) / (1 - STRIPE_PCT - DREAMSCAPE_FEE_PCT)
  return { retail, stripeFee, dreamscapeFee, earnings, margin, breakEven }
}

function PricingCalculator({ baseCost, price, onPriceChange, usingFallback }) {
  const calc = calcEarnings(price, baseCost)

  const marginColor = !calc ? C.muted
    : calc.earnings < 0  ? C.red
    : calc.margin < 20   ? C.gold
    : C.teal

  const marginLabel = !calc ? ''
    : calc.earnings < 0  ? '🚨 Below break-even'
    : calc.margin < 20   ? '⚠️ Low margin'
    : calc.margin < 35   ? '✅ Okay margin'
    : '✅ Healthy margin'

  if (baseCost == null) return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Retail Price (USD)</label>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }}>$</span>
        <input value={price} onChange={e => onPriceChange(e.target.value)} type="number" min="1" step="0.01"
          style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px 10px 26px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>
      <div style={{ background: `${C.gold}15`, border: `1px solid ${C.gold}44`, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: C.gold }}>
        ⚠️ Pricing data unavailable for this product — please research Printful's cost before listing to ensure you make a profit.
      </div>
    </div>
  )

  const suggested = Math.ceil(baseCost * 2.4 * 100) / 100

  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Retail Price (USD)</label>
      {usingFallback && (
        <div style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}33`, borderRadius: 8, padding: '8px 12px', fontSize: 11, color: C.gold, marginBottom: 8 }}>
          ℹ️ Using estimated base cost (~${baseCost.toFixed(2)}) — Printful pricing not returned for this product. Verify at printful.com before listing.
        </div>
      )}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13, zIndex: 1 }}>$</span>
        <input value={price} onChange={e => onPriceChange(e.target.value)} type="number" min="1" step="0.01"
          style={{ width: '100%', background: C.bg, border: `2px solid ${marginColor}55`, borderRadius: 10, padding: '10px 14px 10px 26px', color: C.text, fontSize: 15, fontWeight: 700, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>

      {/* Quick-pick chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Break-even', val: calc ? Math.ceil(calc.breakEven * 100) / 100 : null, color: C.muted },
          { label: 'Suggested (40%)', val: suggested, color: C.teal },
          { label: 'Premium (55%)', val: Math.ceil(baseCost * 3.0 * 100) / 100, color: C.gold },
        ].filter(c => c.val).map(chip => (
          <button key={chip.label} onClick={() => onPriceChange(chip.val.toFixed(2))}
            style={{ background: `${chip.color}15`, border: `1px solid ${chip.color}44`, borderRadius: 8, padding: '4px 10px', color: chip.color, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            {chip.label}: ${chip.val.toFixed(2)}
          </button>
        ))}
      </div>

      {/* Breakdown */}
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '9px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
          💰 Pricing Breakdown
        </div>
        {[
          { label: `Printful base cost${usingFallback ? ' (est.)' : ''}`, val: `-$${baseCost.toFixed(2)}`, color: C.muted, bold: false },
          { label: 'Stripe fee (~2.9% + $0.30)', val: calc ? `-$${calc.stripeFee.toFixed(2)}` : '—', color: C.muted, bold: false },
          { label: 'Dreamscape fee (10%)', val: calc ? `-$${calc.dreamscapeFee.toFixed(2)}` : '—', color: C.muted, bold: false },
          { label: 'Your earnings', val: calc ? `$${calc.earnings.toFixed(2)}` : '—', color: marginColor, bold: true },
          { label: 'Profit margin', val: calc ? `${Math.round(calc.margin)}%` : '—', color: marginColor, bold: true },
        ].map(row => (
          <div key={row.label} style={{ padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 12, color: C.muted }}>{row.label}</span>
            <span style={{ fontSize: 13, fontWeight: row.bold ? 700 : 400, color: row.color }}>{row.val}</span>
          </div>
        ))}
        {calc && (
          <div style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: marginColor, fontWeight: 700 }}>{marginLabel}</span>
              <span style={{ fontSize: 11, color: C.muted }}>break-even: ${calc.breakEven.toFixed(2)}</span>
            </div>
            <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, calc.margin))}%`, background: `linear-gradient(90deg, ${marginColor}, ${marginColor}cc)`, borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const STEPS = ['Upload', 'Product', 'Design', 'Colors', 'Details', 'Done']

export default function CreateProductModal({ user, imageUrl, artworkId, title: defaultTitle, onClose, onSuccess }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [hostedImageUrl, setHostedImageUrl] = useState('')
  const [placement, setPlacement] = useState(null)

  // Step 2
  const [catalog, setCatalog] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [variantLoading, setVariantLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Step 4 — colors
  const [availableColors, setAvailableColors] = useState([])
  const [selectedColors, setSelectedColors] = useState([])
  const [previewColor, setPreviewColor] = useState(null)
  const [mockupStatus, setMockupStatus] = useState('idle')
  const [mockupUrl, setMockupUrl] = useState('')
  const mockupPollRef = useRef(null)

  // Step 5 — details
  const [title, setTitle] = useState(defaultTitle || '')
  const [titleTouched, setTitleTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('35.00')
  const [tags, setTags] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [baseCost, setBaseCost] = useState(null)       // Printful wholesale cost
  const [usingFallback, setUsingFallback] = useState(false) // true if API had no pricing

  useEffect(() => {
    loadCatalog()
    if (imageUrl?.startsWith('data:')) uploadDataUrl(imageUrl)
    else { setHostedImageUrl(imageUrl || ''); setStep(2) }
    return () => { if (mockupPollRef.current) clearTimeout(mockupPollRef.current) }
  }, [])

  useEffect(() => {
    if (selected && !titleTouched) setTitle(`${defaultTitle || 'My Design'} ${selected.model}`)
  }, [selected])

  const uploadDataUrl = async (dataUrl) => {
    setStep(1)
    try {
      const [header, data] = dataUrl.split(',')
      const mime = header.match(/:(.*?);/)[1]
      const ext = mime.split('/')[1] || 'png'
      const byteStr = atob(data)
      const bytes = new Uint8Array(byteStr.length)
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i)
      const blob = new Blob([bytes], { type: mime })
      const path = `${user.id}/${Date.now()}.${ext}`
      const { data: up, error: upErr } = await supabase.storage.from('artwork').upload(path, blob, { contentType: mime })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('artwork').getPublicUrl(up.path)
      setHostedImageUrl(publicUrl)
      setStep(2)
    } catch (e) { setError('Upload failed: ' + e.message); setStep(2) }
  }

  const loadCatalog = async () => {
    setCatalogLoading(true)
    try {
      const res = await fetch('/api/printful?action=catalog&offset=0')
      const data = await res.json()
      const SKIP = ['embroidered', 'embroidery', 'structured cap', 'dad hat', 'trucker hat', 'beanie', 'snapback', 'baseball cap', 'bucket hat']
      const filtered = (data.products || []).filter(p => !SKIP.some(kw => (p.model || '').toLowerCase().includes(kw)))
      setCatalog(filtered)
    } catch {}
    setCatalogLoading(false)
  }

  const selectProduct = async (p) => {
    setSelected(p)
    setAvailableColors([])
    setSelectedColors([])
    setPreviewColor(null)
    setMockupUrl('')
    setMockupStatus('idle')
    setVariantLoading(true)
    try {
      const res = await fetch(`/api/printful?action=catalogProduct&id=${p.id}`)
      const data = await res.json()
      const variants = data.variants || []
      const colorMap = {}
      for (const v of variants) {
        const name = v.color || 'Default'
        const hex = v.color_code || '#888'
        if (!colorMap[name]) colorMap[name] = { name, hex, variantIds: [], image: v.image || p.image || '' }
        colorMap[name].variantIds.push(v.id)
        if (v.image && !colorMap[name].image) colorMap[name].image = v.image
      }
      const colors = Object.values(colorMap).slice(0, 30)
      setAvailableColors(colors)
      const def = colors.find(c => c.name.toLowerCase().includes('white')) || colors[0]
      if (def) { setSelectedColors([def.name]); setPreviewColor(def) }
      setSelected({ ...p, variants })

      // Extract base cost — prefer API wholesale_cost, fall back to price field, then fallback table
      const apiPrices = variants
        .map(v => parseFloat(v.wholesale_cost || v.price || 0))
        .filter(n => n > 0)
      const apiCost = apiPrices.length ? Math.min(...apiPrices) : null
      const resolved = resolveBaseCost(apiCost, p.type)
      const isFallback = apiCost == null && resolved != null
      setBaseCost(resolved)
      setUsingFallback(isFallback)

      // Auto-suggest price at ~2.4x cost for healthy 40%+ margin after all fees
      if (resolved) {
        const suggested = Math.ceil(resolved * 2.4 * 100) / 100
        setPrice(suggested.toFixed(2))
      }
    } catch {}
    setVariantLoading(false)
  }

  const toggleColor = (color) => {
    setSelectedColors(prev => prev.includes(color.name) ? prev.filter(c => c !== color.name) : [...prev, color.name])
    setPreviewColor(color)
  }

  const generateMockup = async () => {
    if (!previewColor || !hostedImageUrl || !selected) return
    setMockupStatus('generating')
    try {
      const variantIds = previewColor.variantIds.slice(0, 3)
      const res = await fetch('/api/printful?action=mockupCreate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogProductId: selected.id, variantIds, imageUrl: hostedImageUrl }),
      })
      const data = await res.json()
      if (data.task_key) pollMockup(data.task_key, null, 0)
      else setMockupStatus('failed')
    } catch { setMockupStatus('failed') }
  }

  const pollMockup = async (taskKey, productId, attempt = 0) => {
    if (attempt > 20) { setMockupStatus('failed'); return }
    try {
      const res = await fetch(`/api/printful?action=mockupStatus&taskKey=${encodeURIComponent(taskKey)}`)
      const data = await res.json()
      if (data.status === 'completed') {
        const url = data.mockups?.[0]?.mockup_url || data.mockups?.[0]?.url || ''
        if (url) {
          setMockupUrl(url)
          setMockupStatus('done')
          if (productId) await supabase.from('products').update({ mockup_url: url }).eq('id', productId)
        } else setMockupStatus('failed')
      } else if (data.status === 'failed') {
        setMockupStatus('failed')
      } else {
        mockupPollRef.current = setTimeout(() => pollMockup(taskKey, productId, attempt + 1), 3000)
      }
    } catch {
      mockupPollRef.current = setTimeout(() => pollMockup(taskKey, productId, attempt + 1), 3000)
    }
  }

  const handleCreate = async () => {
    if (!title.trim()) return setError('Product title is required.')
    if (!hostedImageUrl) return setError('No image available.')
    if (!selected) return setError('Please select a product type.')
    if (selectedColors.length === 0) return setError('Please select at least one color.')
    // Enforce minimum profit — never allow listing below break-even
    if (baseCost != null) {
      const profitCheck = calcEarnings(price, baseCost)
      if (!profitCheck || profitCheck.earnings <= 0) {
        const floor = (baseCost + STRIPE_FIXED) / (1 - STRIPE_PCT - DREAMSCAPE_FEE_PCT)
        return setError(`Price is too low. You must charge at least $${(Math.ceil(floor * 100) / 100).toFixed(2)} to cover Printful cost + fees and make a profit.`)
      }
    }
    setError(''); setCreating(true)
    try {
      const { data: prof } = await supabase.from('profiles').select('subscription_tier').eq('id', user.id).single()
      const tier = prof?.subscription_tier || 'free'
      const limitCheck = await checkProductLimit(user.id, tier)
      if (!limitCheck.allowed) {
        setError(`You've reached your ${limitCheck.limit} product limit on the ${tier} plan. Delete a product or upgrade.`)
        setCreating(false); return
      }
      const selectedColorObjs = availableColors.filter(c => selectedColors.includes(c.name))
      const allVariantIds = selectedColorObjs.flatMap(c => c.variantIds)
      const res = await fetch('/api/printful?action=create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, variantIds: allVariantIds, imageUrl: hostedImageUrl, retailPrice: price }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error) || 'Printful error')
      const printfulId = data.id || data.sync_product?.id || ''
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
      const { data: inserted } = await supabase.from('products').insert({
        user_id: user.id, artwork_id: artworkId || null,
        title, description, product_type: selected.type,
        price: parseFloat(price),
        printful_product_id: String(printfulId),
        printful_variant_ids: allVariantIds.map(String),
        mockup_url: mockupUrl || hostedImageUrl,
        tags: tagList,
      }).select().single()
      if (!mockupUrl && selectedColorObjs[0]) {
        const variantIds = selectedColorObjs[0].variantIds.slice(0, 3)
        const mRes = await fetch('/api/printful?action=mockupCreate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ catalogProductId: selected.id, variantIds, imageUrl: hostedImageUrl }),
        })
        const mData = await mRes.json()
        if (mData.task_key) pollMockup(mData.task_key, inserted?.id, 0)
      }
      setStep(6)
    } catch (e) { setError(e.message) }
    setCreating(false)
  }

  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100
  const filtered = catalog.filter(p => !search || (p.model || '').toLowerCase().includes(search.toLowerCase()) || (p.type || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && step < 6 && onClose()}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 620, maxHeight: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text, margin: 0 }}>
              {step === 6 ? '✦ Product Created!' : 'Create a Product'}
            </h3>
            {step < 6 && <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>}
          </div>
          <div style={{ height: 3, background: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.teal})`, borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            {STEPS.map((s, i) => (
              <span key={s} style={{ fontSize: 9, color: step > i + 1 ? C.teal : step === i + 1 ? C.accent : C.muted, fontWeight: step === i + 1 ? 700 : 400 }}>{s}</span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* Step 1: Upload */}
          {step === 1 && <div style={{ padding: '20px 24px' }}><Spinner label="Uploading your artwork..." /></div>}

          {/* Step 2: Product type */}
          {step === 2 && (
            <div style={{ padding: '0 24px 20px' }}>
              {hostedImageUrl && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: `${C.teal}10`, border: `1px solid ${C.teal}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                  <img src={hostedImageUrl} alt="Art" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>Artwork ready — pick a product to print on</div>
                </div>
              )}
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search t-shirts, hoodies, mugs, posters..."
                style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14 }} />
              {catalogLoading ? <Spinner label="Loading catalog..." /> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: 10 }}>
                  {filtered.slice(0, 60).map(p => (
                    <div key={p.id} onClick={() => selectProduct(p)}
                      style={{ background: selected?.id === p.id ? `${C.accent}20` : C.bg, border: `2px solid ${selected?.id === p.id ? C.accent : C.border}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { if (selected?.id !== p.id) e.currentTarget.style.borderColor = C.accent + '66' }}
                      onMouseLeave={e => { if (selected?.id !== p.id) e.currentTarget.style.borderColor = C.border }}>
                      <div style={{ height: 78, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#f8f8f8' }}>
                        {p.image ? <img src={p.image} alt={p.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 26 }}>🎨</span>}
                      </div>
                      <div style={{ padding: '6px 8px' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: selected?.id === p.id ? C.accent : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.model}</div>
                        <div style={{ fontSize: 9, color: C.muted }}>{p.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Art Placement Editor */}
          {step === 3 && selected && (
            <div style={{ padding: '0 24px 20px' }}>
              <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: C.text }}>
                <strong style={{ color: C.accent }}>✦ Design Editor</strong> — Drag your artwork to position it on the <strong>{selected.model}</strong>. Resize with the slider.
              </div>
              <ArtPlacementEditor
                artworkUrl={hostedImageUrl}
                productImage={previewColor?.image || selected.image}
                productName={selected.model}
                onPlacementChange={setPlacement}
              />
            </div>
          )}

          {/* Step 4: Colors */}
          {step === 4 && (
            <div style={{ padding: '0 24px 20px' }}>
              {/* Preview */}
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
                <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: '#f0f0f0' }}>
                  {mockupStatus === 'generating' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,11,20,0.7)', zIndex: 2 }}>
                      <Spinner label="Generating preview..." />
                    </div>
                  )}
                  {mockupStatus === 'done' && mockupUrl ? (
                    <img src={mockupUrl} alt="Mockup" style={{ maxHeight: 240, maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                  ) : previewColor?.image ? (
                    <img src={previewColor.image} alt={previewColor.name} style={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain', opacity: 0.8 }} />
                  ) : (
                    <div style={{ padding: 32, textAlign: 'center' }}>
                      <div style={{ fontSize: 40, marginBottom: 8 }}>🎨</div>
                      <div style={{ fontSize: 12, color: C.muted }}>Select a color to preview</div>
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {previewColor && <span style={{ width: 14, height: 14, borderRadius: '50%', background: previewColor.hex, border: '2px solid rgba(255,255,255,0.2)', display: 'inline-block' }} />}
                    {previewColor?.name || 'Pick a color'}
                  </div>
                  {previewColor && mockupStatus !== 'generating' && (
                    <button onClick={generateMockup}
                      style={{ background: `${C.teal}20`, border: `1px solid ${C.teal}44`, borderRadius: 8, padding: '5px 12px', color: C.teal, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {mockupStatus === 'done' ? '↻ Regenerate' : '✦ Generate Preview'}
                    </button>
                  )}
                </div>
              </div>

              {/* Color grid */}
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Available Colors ({availableColors.length}) — select all you want to offer
              </div>
              {variantLoading ? <Spinner label="Loading colors..." /> : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {availableColors.map(color => {
                    const isSel = selectedColors.includes(color.name)
                    const isPrev = previewColor?.name === color.name
                    return (
                      <button key={color.name} onClick={() => toggleColor(color)} title={color.name}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: isSel ? `${C.accent}20` : C.bg, border: `2px solid ${isPrev ? C.teal : isSel ? C.accent : C.border}`, borderRadius: 20, padding: '4px 10px 4px 5px', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <span style={{ width: 16, height: 16, borderRadius: '50%', background: color.hex, border: '2px solid rgba(255,255,255,0.2)', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: isSel ? C.accent : C.text, fontWeight: isSel ? 700 : 400, whiteSpace: 'nowrap' }}>{color.name}</span>
                        {isSel && <span style={{ fontSize: 10, color: C.accent }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}
              {selectedColors.length > 0 && (
                <div style={{ background: `${C.teal}12`, border: `1px solid ${C.teal}33`, borderRadius: 10, padding: '8px 12px', fontSize: 12, color: C.teal, marginTop: 12 }}>
                  ✓ {selectedColors.length} color{selectedColors.length !== 1 ? 's' : ''}: {selectedColors.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Details */}
          {step === 5 && (
            <div style={{ padding: '0 24px 20px' }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'center' }}>
                <div style={{ width: 80, height: 80, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#f0f0f0' }}>
                  <img src={mockupUrl || hostedImageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{selected?.model}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{selectedColors.length} color{selectedColors.length !== 1 ? 's' : ''}: {selectedColors.slice(0, 3).join(', ')}{selectedColors.length > 3 ? ` +${selectedColors.length - 3}` : ''}</div>
                  {mockupStatus === 'done' && <span style={{ fontSize: 10, color: C.teal, fontWeight: 600 }}>✦ Preview ready</span>}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Product Title</label>
                  <input autoFocus value={title} onChange={e => { setTitle(e.target.value); setTitleTouched(true) }}
                    style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>💡 Include the art style and product type for better search visibility.</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Description <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                    style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Style Tags</label>
                  <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. surreal, neon, abstract, fantasy"
                    style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
                <PricingCalculator
                  baseCost={baseCost}
                  price={price}
                  onPriceChange={setPrice}
                  usingFallback={usingFallback}
                />
                {error && <div style={{ background: '#ff6b6b18', border: '1px solid #ff6b6b44', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ff6b6b' }}>{error}</div>}
              </div>
            </div>
          )}

          {/* Step 6: Done */}
          {step === 6 && (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, marginBottom: 8 }}>Product Created!</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                Your product is live with {selectedColors.length} color{selectedColors.length !== 1 ? 's' : ''}.
                {mockupStatus === 'generating' ? ' Mockup preview is generating.' : mockupStatus === 'done' ? ' Preview is ready.' : ''}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => { onSuccess?.(); navigate('/marketplace') }}
                  style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '11px 22px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  🛍 View in Marketplace
                </button>
                <button onClick={() => { onSuccess?.(); navigate('/profile') }}
                  style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 22px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>
                  My Profile
                </button>
                <button onClick={onClose}
                  style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 22px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 6 && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 18px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>
                ← Back
              </button>
            )}
            <div style={{ flex: 1 }} />

            {step === 2 && (
              <button onClick={() => { if (selected && !variantLoading) setStep(3) }} disabled={!selected || variantLoading}
                style={{ background: !selected || variantLoading ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: !selected || variantLoading ? 'not-allowed' : 'pointer' }}>
                {variantLoading ? 'Loading...' : 'Design It →'}
              </button>
            )}
            {step === 3 && (
              <button onClick={() => setStep(4)}
                style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Choose Colors →
              </button>
            )}
            {step === 4 && (
              <button onClick={() => selectedColors.length > 0 && setStep(5)} disabled={selectedColors.length === 0}
                style={{ background: selectedColors.length === 0 ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: selectedColors.length === 0 ? 'not-allowed' : 'pointer' }}>
                {selectedColors.length === 0 ? 'Select a Color' : `Add Details →`}
              </button>
            )}
            {step === 5 && (() => {
              const _calc = baseCost != null ? calcEarnings(price, baseCost) : null
              const _noProfit = baseCost != null && (!_calc || _calc.earnings <= 0)
              const _disabled = creating || _noProfit
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  {_noProfit && (
                    <div style={{ fontSize: 11, color: C.red, fontWeight: 600, textAlign: 'right', maxWidth: 280 }}>
                      🚨 Price too low — every product on Dreamscape must earn you a profit
                    </div>
                  )}
                  <button onClick={handleCreate} disabled={_disabled}
                    style={{ background: _disabled ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: _disabled ? C.muted : '#fff', fontSize: 13, fontWeight: 700, cursor: _disabled ? 'not-allowed' : 'pointer', opacity: _noProfit ? 0.5 : 1 }}>
                    {creating ? '⏳ Creating...' : _noProfit ? '🔒 Set a Profitable Price' : 'Create Product ✦'}
                  </button>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
