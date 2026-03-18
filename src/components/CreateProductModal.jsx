import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

import { supabase } from '../lib/supabase'

async function getAuthHeader() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) return { 'Authorization': `Bearer ${session.access_token}` }
  } catch {}
  return {}
}


const TIER_LIMITS = {
  free:     { products: 3        },
  starter:  { products: 15       },
  pro:      { products: 50       },
  studio:   { products: Infinity },
  business: { products: Infinity },
}

async function checkProductLimit(userId, tier) {
  if (tier === 'studio' || tier === 'business') return { allowed: true, used: 0, limit: Infinity }
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
      const h = await getAuthHeader()
      const res = await fetch('/api/printful?action=catalog&offset=0', { headers: h })
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
      const h = await getAuthHeader()
      const res = await fetch(`/api/printful?action=catalogProduct&id=${p.id}`, { headers: h })
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
      const h1 = await getAuthHeader()
      const res = await fetch('/api/printful?action=mockupCreate', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...h1 },
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
      const hCreate = await getAuthHeader()
      const res = await fetch('/api/printful?action=create', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...hCreate },
        body: JSON.stringify({ title, description, variantIds: allVariantIds, imageUrl: hostedImageUrl }),
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

  const CATEGORIES = [
    { label: 'T-Shirts',     icon: '👕', keywords: ['t-shirt', 'tee', 'unisex jersey'] },
    { label: 'Hoodies',      icon: '🧥', keywords: ['hoodie', 'sweatshirt', 'pullover', 'crewneck'] },
    { label: 'Mugs',         icon: '☕', keywords: ['mug', 'cup'] },
    { label: 'Posters',      icon: '🖼',  keywords: ['poster', 'print', 'canvas', 'framed'] },
    { label: 'Phone Cases',  icon: '📱', keywords: ['phone case', 'iphone', 'samsung'] },
    { label: 'Tote Bags',    icon: '🛍',  keywords: ['tote', 'bag', 'canvas bag'] },
    { label: 'Tank Tops',    icon: '👙', keywords: ['tank', 'racerback', 'sleeveless'] },
    { label: 'Stickers',     icon: '✨', keywords: ['sticker', 'decal'] },
    { label: 'Hats',         icon: '🧢', keywords: ['hat', 'cap', 'beanie'] },
    { label: 'Blankets',     icon: '🛏',  keywords: ['blanket', 'throw'] },
  ]

  const [activeCategory, setActiveCategory] = useState(null)

  const filtered = (() => {
    const q = search.trim().toLowerCase()
    // If user is typing, search across everything
    if (q) return catalog.filter(p =>
      (p.model || '').toLowerCase().includes(q) ||
      (p.type  || '').toLowerCase().includes(q)
    )
    // If a category chip is selected, filter to that category
    if (activeCategory) {
      const kws = CATEGORIES.find(c => c.label === activeCategory)?.keywords || []
      return catalog.filter(p =>
        kws.some(kw => (p.model || '').toLowerCase().includes(kw) || (p.type || '').toLowerCase().includes(kw))
      )
    }
    // Nothing selected yet — show nothing, prompt user to pick
    return []
  })()

  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100

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
              {/* Artwork preview banner */}
              {hostedImageUrl && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: `${C.teal}10`, border: `1px solid ${C.teal}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                  <img src={hostedImageUrl} alt="Art" style={{ width: 40, height: 40, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>Artwork ready — what would you like to print on?</div>
                </div>
              )}

              {/* Search input */}
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); if (e.target.value) setActiveCategory(null) }}
                  placeholder='Type "shirt", "mug", "poster"...'
                  style={{ width: '100%', background: C.bg, border: `1px solid ${search ? C.accent + '66' : C.border}`, borderRadius: 10, padding: '9px 14px 9px 36px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
                )}
              </div>

              {/* Category chips */}
              {!search && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Browse by category</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {CATEGORIES.map(cat => {
                      const isActive = activeCategory === cat.label
                      return (
                        <button key={cat.label}
                          onClick={() => setActiveCategory(isActive ? null : cat.label)}
                          style={{ background: isActive ? `${C.accent}22` : C.bg, border: `1.5px solid ${isActive ? C.accent + '88' : C.border}`, borderRadius: 20, padding: '6px 14px', color: isActive ? C.accent : C.text, fontSize: 12, fontWeight: isActive ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}>
                          <span>{cat.icon}</span> {cat.label}
                          {isActive && <span style={{ fontSize: 10 }}>✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Product results */}
              {catalogLoading ? (
                <Spinner label="Loading catalog..." />
              ) : filtered.length === 0 && !activeCategory && !search ? (
                /* Prompt state — nothing selected yet */
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <div style={{ fontSize: 38, marginBottom: 10 }}>👆</div>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 4 }}>Pick a category above</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Or type what you're looking for in the search box</div>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
                  <div style={{ fontSize: 13, color: C.muted }}>No products found — try a different search</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
                    {filtered.length} product{filtered.length !== 1 ? 's' : ''} found
                    {activeCategory && ` in ${activeCategory}`}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filtered.slice(0, 20).map(p => (
                      <div key={p.id} onClick={() => selectProduct(p)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, background: selected?.id === p.id ? `${C.accent}18` : C.bg, border: `2px solid ${selected?.id === p.id ? C.accent : C.border}`, borderRadius: 12, padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { if (selected?.id !== p.id) e.currentTarget.style.borderColor = C.accent + '44' }}
                        onMouseLeave={e => { if (selected?.id !== p.id) e.currentTarget.style.borderColor = C.border }}>
                        {/* Product thumbnail */}
                        <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: '#f0f0f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {p.image
                            ? <img src={p.image} alt={p.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: 24 }}>🎨</span>}
                        </div>
                        {/* Product info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: selected?.id === p.id ? C.accent : C.text, marginBottom: 2 }}>{p.model}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{p.type}</div>
                        </div>
                        {/* Select indicator */}
                        {selected?.id === p.id
                          ? <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', flexShrink: 0 }}>✓</div>
                          : <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${C.border}`, flexShrink: 0 }} />
                        }
                      </div>
                    ))}
                  </div>
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
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Retail Price (USD)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }}>$</span>
                    <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="10" step="0.01"
                      style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px 10px 26px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>You keep the difference after Printful base cost + Stripe fees (~2.9% + $0.30).</p>
                </div>
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
            {step === 5 && (
              <button onClick={handleCreate} disabled={creating}
                style={{ background: creating ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer' }}>
                {creating ? '⏳ Creating...' : 'Create Product ✦'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
