import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TIER_LIMITS = {
  free:    { gens: 10,  products: 3  },
  starter: { gens: 50,  products: 15 },
  pro:     { gens: 200, products: 50 },
  studio:  { gens: Infinity, products: Infinity },
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
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
}

function Spinner({ label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 0' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
      </div>
      {label && <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{label}</p>}
    </div>
  )
}

const STEPS = ['Upload', 'Product Type', 'Colors', 'Details', 'Done']

export default function CreateProductModal({ user, imageUrl, artworkId, title: defaultTitle, onClose, onSuccess }) {
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [hostedImageUrl, setHostedImageUrl] = useState('')

  // Step 2 — product type
  const [catalog, setCatalog] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [variantLoading, setVariantLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Step 3 — color/variant selection
  const [availableColors, setAvailableColors] = useState([]) // { name, hex, variantIds, image }
  const [selectedColors, setSelectedColors] = useState([])   // array of color names
  const [previewColor, setPreviewColor] = useState(null)     // color object being previewed
  const [mockupStatus, setMockupStatus] = useState('idle')
  const [mockupUrl, setMockupUrl] = useState('')
  const [mockupsByColor, setMockupsByColor] = useState({})   // color name -> mockup url
  const mockupPollRef = useRef(null)

  // Step 4 — details
  const [title, setTitle] = useState(defaultTitle || '')
  const [titleTouched, setTitleTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('35.00')
  const [tags, setTags] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [createdProductId, setCreatedProductId] = useState(null)

  useEffect(() => {
    loadCatalog()
    if (imageUrl?.startsWith('data:')) {
      uploadDataUrl(imageUrl)
    } else {
      setHostedImageUrl(imageUrl || '')
      setStep(2)
    }
    return () => { if (mockupPollRef.current) clearTimeout(mockupPollRef.current) }
  }, [])

  useEffect(() => {
    if (selected && !titleTouched) {
      setTitle(`${defaultTitle || 'My Design'} ${selected.model}`)
    }
  }, [selected])

  // ── Upload ────────────────────────────────────────────────────
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
    } catch (e) {
      setError('Image upload failed: ' + e.message)
      setStep(2)
    }
  }

  // ── Catalog ───────────────────────────────────────────────────
  const loadCatalog = async () => {
    setCatalogLoading(true)
    try {
      const res = await fetch('/api/printful?action=catalog&offset=0')
      const data = await res.json()
      const EMBROIDERY_KEYWORDS = ['embroidered', 'embroidery', 'structured cap', 'dad hat', 'trucker hat', 'beanie', 'snapback', 'baseball cap', 'bucket hat']
      const filtered = (data.products || []).filter(p => {
        const name = (p.title || p.name || p.model || '').toLowerCase()
        return !EMBROIDERY_KEYWORDS.some(kw => name.includes(kw))
      })
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
    setMockupsByColor({})
    setMockupStatus('idle')

    setVariantLoading(true)
    try {
      const res = await fetch(`/api/printful?action=catalogProduct&id=${p.id}`)
      const data = await res.json()
      const variants = data.variants || []

      // Group variants by color
      const colorMap = {}
      for (const v of variants) {
        const colorName = v.color || v.name?.split('/')[1]?.trim() || 'Default'
        const hex = v.color_code || v.color_code2 || '#888888'
        if (!colorMap[colorName]) {
          colorMap[colorName] = { name: colorName, hex, variantIds: [], image: v.image || '' }
        }
        colorMap[colorName].variantIds.push(v.id)
        if (v.image && !colorMap[colorName].image) colorMap[colorName].image = v.image
      }

      const colors = Object.values(colorMap).slice(0, 30) // max 30 colors
      setAvailableColors(colors)

      // Pre-select white/black if available, else first color
      const defaultColor = colors.find(c => c.name.toLowerCase().includes('white')) ||
                           colors.find(c => c.name.toLowerCase().includes('black')) ||
                           colors[0]
      if (defaultColor) {
        setSelectedColors([defaultColor.name])
        setPreviewColor(defaultColor)
      }

      setSelected({ ...p, variants })
    } catch {}
    setVariantLoading(false)
  }

  const toggleColor = (color) => {
    setSelectedColors(prev =>
      prev.includes(color.name)
        ? prev.filter(c => c !== color.name)
        : [...prev, color.name]
    )
    setPreviewColor(color)
  }

  // ── Generate mockup for preview ───────────────────────────────
  const generatePreviewMockup = async (color) => {
    if (!color || !hostedImageUrl || !selected) return
    if (mockupsByColor[color.name]) {
      setMockupUrl(mockupsByColor[color.name])
      return
    }
    setMockupStatus('generating')
    try {
      const variantIds = color.variantIds.slice(0, 3)
      const res = await fetch('/api/printful?action=mockupCreate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogProductId: selected.id, variantIds, imageUrl: hostedImageUrl }),
      })
      const data = await res.json()
      if (data.task_key) {
        pollMockup(data.task_key, null, 0, color.name)
      } else {
        setMockupStatus('failed')
      }
    } catch {
      setMockupStatus('failed')
    }
  }

  const pollMockup = async (taskKey, productId, attempt = 0, colorName = null) => {
    if (attempt > 20) { setMockupStatus('failed'); return }
    try {
      const res = await fetch(`/api/printful?action=mockupStatus&taskKey=${encodeURIComponent(taskKey)}`)
      const data = await res.json()
      if (data.status === 'completed') {
        const url = data.mockups?.[0]?.mockup_url || data.mockups?.[0]?.url || ''
        if (url) {
          setMockupUrl(url)
          setMockupStatus('done')
          if (colorName) setMockupsByColor(prev => ({ ...prev, [colorName]: url }))
          if (productId) await supabase.from('products').update({ mockup_url: url }).eq('id', productId)
        } else {
          setMockupStatus('failed')
        }
      } else if (data.status === 'failed') {
        setMockupStatus('failed')
      } else {
        mockupPollRef.current = setTimeout(() => pollMockup(taskKey, productId, attempt + 1, colorName), 3000)
      }
    } catch {
      mockupPollRef.current = setTimeout(() => pollMockup(taskKey, productId, attempt + 1, colorName), 3000)
    }
  }

  // ── Create product ────────────────────────────────────────────
  const handleCreate = async () => {
    if (!title.trim()) return setError('Product title is required.')
    if (!hostedImageUrl) return setError('No image URL available.')
    if (!selected) return setError('Please select a product type.')
    if (selectedColors.length === 0) return setError('Please select at least one color.')
    setError(''); setCreating(true)

    try {
      // Check product limit
      const { data: prof } = await supabase.from('profiles').select('subscription_tier').eq('id', user.id).single()
      const tier = prof?.subscription_tier || 'free'
      const limitCheck = await checkProductLimit(user.id, tier)
      if (!limitCheck.allowed) {
        const tierName = tier.charAt(0).toUpperCase() + tier.slice(1)
        setError(`You've reached your ${limitCheck.limit} product limit on the ${tierName} plan. Delete a product or upgrade to list more.`)
        setCreating(false)
        return
      }

      // Collect all variant IDs for selected colors
      const selectedColorObjs = availableColors.filter(c => selectedColors.includes(c.name))
      const allVariantIds = selectedColorObjs.flatMap(c => c.variantIds)

      const res = await fetch('/api/printful?action=create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, variantIds: allVariantIds, imageUrl: hostedImageUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error) || 'Printful error')

      const printfulId = data.id || data.sync_product?.id || ''
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)

      const { data: inserted } = await supabase.from('products').insert({
        user_id: user.id,
        artwork_id: artworkId || null,
        title,
        description,
        product_type: selected.type,
        price: parseFloat(price),
        printful_product_id: String(printfulId),
        printful_variant_ids: allVariantIds.map(String),
        mockup_url: mockupUrl || hostedImageUrl,
        tags: tagList,
      }).select().single()

      const newProductId = inserted?.id || null
      setCreatedProductId(newProductId)

      // Generate final mockup if not already done
      if (!mockupUrl && selectedColorObjs[0]) {
        const variantIds = selectedColorObjs[0].variantIds.slice(0, 3)
        const mRes = await fetch('/api/printful?action=mockupCreate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ catalogProductId: selected.id, variantIds, imageUrl: hostedImageUrl }),
        })
        const mData = await mRes.json()
        if (mData.task_key) pollMockup(mData.task_key, newProductId, 0, selectedColorObjs[0].name)
      }

      setStep(5)
    } catch (e) {
      setError(e.message)
    }
    setCreating(false)
  }

  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100
  const filtered = catalog.filter(p =>
    !search || p.model?.toLowerCase().includes(search.toLowerCase()) || p.type?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && step < 5 && onClose()}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text, margin: 0 }}>
              {step === 5 ? '✦ Product Created!' : 'Create a Product'}
            </h3>
            {step < 5 && <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>}
          </div>
          {/* Progress */}
          <div style={{ height: 3, background: C.border, borderRadius: 3, marginBottom: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.teal})`, borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            {STEPS.map((s, i) => (
              <span key={s} style={{ fontSize: 10, color: step > i + 1 ? C.teal : step === i + 1 ? C.accent : C.muted, fontWeight: step === i + 1 ? 700 : 400 }}>{s}</span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* Step 1: Uploading */}
          {step === 1 && <div style={{ padding: '20px 24px' }}><Spinner label="Uploading your artwork..." /></div>}

          {/* Step 2: Product Type */}
          {step === 2 && (
            <div style={{ padding: '0 24px 20px' }}>
              {hostedImageUrl && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: `${C.teal}10`, border: `1px solid ${C.teal}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                  <img src={hostedImageUrl} alt="Artwork" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Artwork ready — select a product</div>
                    <div style={{ fontSize: 11, color: C.muted }}>T-shirts, hoodies, mugs, posters and more</div>
                  </div>
                </div>
              )}
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search t-shirts, hoodies, mugs, posters..."
                style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14 }} />
              {catalogLoading ? <Spinner label="Loading Printful catalog..." /> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                  {filtered.slice(0, 60).map(p => (
                    <div key={p.id} onClick={() => selectProduct(p)}
                      style={{ background: selected?.id === p.id ? `${C.accent}20` : C.bg, border: `2px solid ${selected?.id === p.id ? C.accent : C.border}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { if (selected?.id !== p.id) e.currentTarget.style.borderColor = C.accent + '66' }}
                      onMouseLeave={e => { if (selected?.id !== p.id) e.currentTarget.style.borderColor = C.border }}>
                      <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {p.image ? <img src={p.image} alt={p.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 28 }}>🎨</span>}
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

          {/* Step 3: Color Selection + Preview */}
          {step === 3 && (
            <div style={{ padding: '0 24px 20px' }}>
              {/* Live Preview */}
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ position: 'relative', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: previewColor?.hex ? previewColor.hex + '22' : C.card }}>
                  {mockupStatus === 'generating' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,11,20,0.7)' }}>
                      <Spinner label="Generating preview..." />
                    </div>
                  )}
                  {mockupStatus === 'done' && mockupUrl ? (
                    <img src={mockupUrl} alt="Product preview" style={{ maxHeight: 260, maxWidth: '100%', objectFit: 'contain', display: 'block', background: '#fff', borderRadius: 8 }} />
                  ) : previewColor?.image ? (
                    <img src={previewColor.image} alt={previewColor.name} style={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain', opacity: 0.7 }} />
                  ) : (
                    <div style={{ textAlign: 'center', padding: 32 }}>
                      <div style={{ fontSize: 48, marginBottom: 8 }}>🎨</div>
                      <div style={{ fontSize: 12, color: C.muted }}>Select a color to preview</div>
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>
                    {previewColor ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 14, height: 14, borderRadius: '50%', background: previewColor.hex, border: '1px solid rgba(255,255,255,0.3)', display: 'inline-block' }} />
                        {previewColor.name}
                      </span>
                    ) : 'No color selected'}
                  </div>
                  {previewColor && mockupStatus !== 'generating' && (
                    <button onClick={() => generatePreviewMockup(previewColor)}
                      style={{ background: `${C.teal}20`, border: `1px solid ${C.teal}44`, borderRadius: 8, padding: '5px 12px', color: C.teal, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      ✦ Generate Preview
                    </button>
                  )}
                </div>
              </div>

              {/* Color grid */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                  Available Colors ({availableColors.length}) — select all you want to offer
                </div>
                {variantLoading ? <Spinner label="Loading colors..." /> : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {availableColors.map(color => {
                      const isSelected = selectedColors.includes(color.name)
                      const isPreviewing = previewColor?.name === color.name
                      return (
                        <button key={color.name} onClick={() => toggleColor(color)}
                          title={color.name}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: isSelected ? `${C.accent}20` : C.bg,
                            border: `2px solid ${isPreviewing ? C.teal : isSelected ? C.accent : C.border}`,
                            borderRadius: 20, padding: '5px 12px 5px 6px',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}>
                          <span style={{ width: 18, height: 18, borderRadius: '50%', background: color.hex, border: '2px solid rgba(255,255,255,0.25)', display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: isSelected ? C.accent : C.text, fontWeight: isSelected ? 700 : 400, whiteSpace: 'nowrap' }}>{color.name}</span>
                          {isSelected && <span style={{ fontSize: 10, color: C.accent }}>✓</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {selectedColors.length > 0 && (
                <div style={{ background: `${C.teal}12`, border: `1px solid ${C.teal}33`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: C.teal }}>
                  ✓ {selectedColors.length} color{selectedColors.length !== 1 ? 's' : ''} selected: {selectedColors.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Details */}
          {step === 4 && (
            <div style={{ padding: '0 24px 20px' }}>
              {/* Preview at top */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
                <div style={{ width: 100, height: 100, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: C.bg, border: `1px solid ${C.border}` }}>
                  <img src={mockupUrl || hostedImageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{selected?.model}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{selectedColors.length} color{selectedColors.length !== 1 ? 's' : ''}: {selectedColors.slice(0, 3).join(', ')}{selectedColors.length > 3 ? `+${selectedColors.length - 3}` : ''}</div>
                  {mockupStatus === 'done' && <span style={{ fontSize: 10, color: C.teal, fontWeight: 600 }}>✦ Preview ready</span>}
                  {mockupStatus === 'generating' && <span style={{ fontSize: 10, color: C.accent }}>⏳ Generating preview...</span>}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Product Title</label>
                <input autoFocus value={title} onChange={e => { setTitle(e.target.value); setTitleTouched(true) }}
                  style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>💡 Include the style and product type for better discovery.</p>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Description <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                  style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Style Tags</label>
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. surreal, neon, abstract, fantasy"
                  style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Retail Price (USD)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }}>$</span>
                  <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="10" step="0.01"
                    style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px 10px 26px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
                <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>You keep the difference after Printful base cost + Stripe fees (~2.9% + $0.30).</p>
              </div>

              {error && <div style={{ background: '#ff6b6b18', border: '1px solid #ff6b6b44', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#ff6b6b' }}>{error}</div>}
            </div>
          )}

          {/* Step 5: Done */}
          {step === 5 && (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 8 }}>Product Created!</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                Your product is live in the marketplace with {selectedColors.length} color{selectedColors.length !== 1 ? 's' : ''}.
                {mockupStatus === 'generating' ? ' Product preview is being generated.' : mockupStatus === 'done' ? ' Preview is ready.' : ''}
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

        {/* Footer nav buttons */}
        {step < 5 && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
            {step > 1 && step < 5 && (
              <button onClick={() => setStep(s => s - 1)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 20px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>← Back</button>
            )}
            <div style={{ flex: 1 }} />
            {step === 2 && (
              <button onClick={() => selected && setStep(3)} disabled={!selected || variantLoading}
                style={{ background: !selected || variantLoading ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: !selected || variantLoading ? 'not-allowed' : 'pointer' }}>
                {variantLoading ? 'Loading...' : 'Choose Colors →'}
              </button>
            )}
            {step === 3 && (
              <button onClick={() => selectedColors.length > 0 && setStep(4)} disabled={selectedColors.length === 0}
                style={{ background: selectedColors.length === 0 ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: selectedColors.length === 0 ? 'not-allowed' : 'pointer' }}>
                {selectedColors.length === 0 ? 'Select a Color' : `Continue with ${selectedColors.length} color${selectedColors.length !== 1 ? 's' : ''} →`}
              </button>
            )}
            {step === 4 && (
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
