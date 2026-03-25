import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

async function getAuthHeader() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) return { 'Authorization': `Bearer ${session.access_token}` }
  } catch {}
  return {}
}

const TIER_LIMITS = {
  free: { products: 3 }, starter: { products: 15 }, pro: { products: 50 },
  studio: { products: Infinity }, merchant: { products: Infinity },
  brand: { products: Infinity }, enterprise: { products: Infinity },
}
async function checkProductLimit(userId, tier) {
  if (['studio','merchant','brand','enterprise'].includes(tier)) return { allowed: true, used: 0, limit: Infinity }
  const limit = TIER_LIMITS[tier]?.products || 3
  const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  return { allowed: (count || 0) < limit, used: count || 0, limit }
}

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494', red: '#FF4D4D',
}

// ── Profit calculator ─────────────────────────────────────────
function getBaseCost(modelName = '') {
  const m = modelName.toLowerCase()
  if (m.includes('hoodie') || m.includes('sweatshirt') || m.includes('pullover')) return 27.95
  if (m.includes('crewneck') || m.includes('crew neck')) return 22.95
  if (m.includes('tank') || m.includes('racerback') || m.includes('sleeveless')) return 12.95
  if (m.includes('long sleeve') || m.includes('longsleeve')) return 17.95
  if (m.includes('kids') || m.includes('youth') || m.includes('toddler') || m.includes('baby') || m.includes('onesie')) return 10.95
  if (m.includes('t-shirt') || m.includes('tee') || m.includes('jersey') || m.includes('cotton tee') || m.includes('unisex t') || m.includes('classic t')) return 14.95
  if (m.includes('acrylic print') || m.includes('acrylic')) return 39.95
  if (m.includes('metal print') || m.includes('aluminum') || m.includes('dibond')) return 34.95
  if (m.includes('wood print') || m.includes('wood art')) return 29.95
  if (m.includes('canvas') && !m.includes('tote')) return 29.95
  if (m.includes('framed')) return 34.95
  if (m.includes('poster') || m.includes('print') || m.includes('art print')) return 11.95
  if (m.includes('mug') || m.includes('cup') || m.includes('ceramic')) return 9.95
  if (m.includes('phone case') || m.includes('iphone') || m.includes('samsung') || m.includes('snap case') || m.includes('tough case')) return 14.95
  if (m.includes('tote') || m.includes('canvas bag')) return 12.95
  if (m.includes('pillow') || m.includes('cushion')) return 22.95
  if (m.includes('blanket') || m.includes('throw') || m.includes('sherpa')) return 39.95
  if (m.includes('sticker') || m.includes('decal')) return 4.95
  if (m.includes('hat') || m.includes('cap') || m.includes('beanie')) return 17.95
  return 14.95
}

function calcProfit(retail, base) {
  const r = parseFloat(retail)
  if (!r || !base || isNaN(r)) return null
  const stripeFee = r * 0.029 + 0.30
  const dreamFee  = r * 0.10
  const earnings  = r - base - stripeFee - dreamFee
  const margin    = (earnings / r) * 100
  const breakEven = (base + 0.30) / (1 - 0.029 - 0.10)
  return { earnings, margin, breakEven }
}

function suggestPrice(base) {
  // Aim for ~38% margin after all fees
  const raw = (base + 0.30) / (1 - 0.038 - 0.10 - 0.029)
  // Round up to nearest .99
  return (Math.ceil(raw) - 0.01).toFixed(2)
}

// ── Broad category keywords matching Printful's naming ────────
const CATEGORIES = [
  { label: 'T-Shirts',      icon: '👕', kw: ['t-shirt','tee','jersey','cotton tee','unisex t','classic t','heavy t','bella','next level','soft style','ring spun','comfort colors'] },
  { label: 'Hoodies',       icon: '🧥', kw: ['hoodie','sweatshirt','pullover','crewneck','crew neck','fleece','quarter zip'] },
  { label: 'Mugs',          icon: '☕', kw: ['mug','cup','ceramic','latte','travel mug'] },
  { label: 'Posters',       icon: '🖼',  kw: ['poster','matte poster','glossy poster','photo print'] },
  { label: 'Canvas Prints', icon: '🎨', kw: ['canvas print','gallery wrapped canvas','stretched canvas','canvas wrap','canvas art'] },
  { label: 'Framed Prints', icon: '🖼',  kw: ['framed poster','framed print','wood framed','framed art','framed canvas'] },
  { label: 'Wall Art',      icon: '🏛',  kw: ['metal print','acrylic print','wood print','dibond','aluminum print','poster hanger','wall art'] },
  { label: 'Phone Cases',   icon: '📱', kw: ['phone case','iphone','samsung','snap case','tough case','clear case','galaxy'] },
  { label: 'Tote Bags',     icon: '🛍',  kw: ['tote','canvas bag','grocery bag','shopping bag'] },
  { label: 'Pillows',       icon: '🛋',  kw: ['pillow','cushion','throw pillow','accent pillow'] },
  { label: 'Tank Tops',     icon: '👙', kw: ['tank','racerback','sleeveless','muscle shirt','jersey tank'] },
  { label: 'Stickers',      icon: '✨', kw: ['sticker','decal','die cut','vinyl sticker','kiss cut'] },
  { label: 'Hats',          icon: '🧢', kw: ['hat','cap','beanie','snapback','trucker','dad hat','bucket hat','fitted'] },
  { label: 'Blankets',      icon: '🛏',  kw: ['blanket','throw','sherpa','fleece blanket'] },
  { label: 'Kids',          icon: '👶', kw: ['kids','youth','toddler','baby','onesie','children','infant','romper'] },
  { label: 'Long Sleeve',   icon: '👔', kw: ['long sleeve','longsleeve','long-sleeve'] },
  { label: 'All-Over',      icon: '🎨', kw: ['all-over','allover','aop','cut & sew','sublimation'] },
]

function matchesCategory(p, cat) {
  const model = (p.model || '').toLowerCase()
  const type  = (p.type  || '').toLowerCase()
  return cat.kw.some(kw => model.includes(kw) || type.includes(kw))
}

// ── Spinner ───────────────────────────────────────────────────
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

// ── Steps: Product → Colors → Details → Done (4 steps, no placement) ──
const STEPS = ['Product', 'Colors', 'Details', 'Done']

export default function CreateProductModal({ user, imageUrl, artworkId, title: defaultTitle, onClose, onSuccess }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(imageUrl?.startsWith('data:') ? 0 : 1)
  const [hostedImageUrl, setHostedImageUrl] = useState(imageUrl?.startsWith('data:') ? '' : (imageUrl || ''))

  // Step 1 — product selection
  const [catalog, setCatalog]           = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [selected, setSelected]         = useState(null)
  const [variantLoading, setVariantLoading] = useState(false)
  const [search, setSearch]             = useState('')
  const [activeCategory, setActiveCategory] = useState(null)

  // Step 2 — colors
  const [availableColors, setAvailableColors] = useState([])
  const [selectedColors, setSelectedColors]   = useState([])
  const [previewColor, setPreviewColor]       = useState(null)
  const [mockupStatus, setMockupStatus]       = useState('idle')
  const [mockupUrl, setMockupUrl]             = useState('')
  const mockupPollRef = useRef(null)

  // Step 3 — details
  const [title, setTitle]           = useState(defaultTitle || '')
  const [titleTouched, setTitleTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [price, setPrice]           = useState('')
  const [tags, setTags]             = useState('')
  const [creating, setCreating]     = useState(false)
  const [error, setError]           = useState('')
  const [aiDetailsLoading, setAiDetailsLoading] = useState(false)

  const inp = { width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }

  useEffect(() => {
    loadCatalog()
    if (imageUrl?.startsWith('data:')) uploadDataUrl(imageUrl)
    return () => { if (mockupPollRef.current) clearTimeout(mockupPollRef.current) }
  }, [])

  // Auto-title when product selected
  useEffect(() => {
    if (selected && !titleTouched) setTitle(`${defaultTitle || 'My Design'} — ${selected.model}`)
  }, [selected])

  // Auto-suggest price when product selected
  useEffect(() => {
    if (selected && !price) setPrice(suggestPrice(getBaseCost(selected.model)))
  }, [selected])

  // Auto-generate product details when reaching step 3
  useEffect(() => {
    if (step !== 3 || aiDetailsLoading) return
    const hasDetails = titleTouched || description.trim() || tags.trim()
    if (hasDetails) return // Don't overwrite what user already typed
    generateProductDetails()
  }, [step])

  const generateProductDetails = async () => {
    if (!selected) return
    setAiDetailsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const artPrompt   = defaultTitle || 'AI generated artwork'
      const productType = selected.type || selected.model || 'product'

      const res = await fetch('/api/dream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `You are a product copywriter for an AI art print-on-demand store. Generate listing details for a ${productType} featuring this artwork: "${artPrompt}".

Reply with ONLY a valid JSON object, no markdown, no explanation:
{"title":"catchy product title max 80 chars","description":"2 engaging sentences about this product","tags":"tag1,tag2,tag3,tag4,tag5"}`
          }]
        })
      })

      const data = await res.json()
      const replyText = data.reply || data.generationPrompt || ''

      // Extract JSON — handle cases where Dream wraps it in text
      const jsonMatch = replyText.match(/\{[^{}]*"title"[^{}]*"description"[^{}]*"tags"[^{}]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.title)       { setTitle(parsed.title);       setTitleTouched(true) }
          if (parsed.description)   setDescription(parsed.description)
          if (parsed.tags)          setTags(parsed.tags)
        } catch {}
      }
    } catch (e) {
      console.log('AI details generation failed:', e.message)
    }
    setAiDetailsLoading(false)
  }

  const uploadDataUrl = async (dataUrl) => {
    setStep(0)
    try {
      const [header, b64] = dataUrl.split(',')
      const mime = header.match(/:(.*?);/)[1]
      const ext  = mime.split('/')[1] || 'png'
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      const blob  = new Blob([bytes], { type: mime })
      const path  = `${user.id}/${Date.now()}.${ext}`
      const { data: up, error: upErr } = await supabase.storage.from('artwork').upload(path, blob, { contentType: mime })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('artwork').getPublicUrl(up.path)
      setHostedImageUrl(publicUrl)
      setStep(1)
    } catch (e) { setError('Upload failed: ' + e.message); setStep(1) }
  }

  const loadCatalog = async () => {
    setCatalogLoading(true)
    try {
      const h = await getAuthHeader()
      const res  = await fetch('/api/printful?action=catalog&offset=0', { headers: h })
      const data = await res.json()
      // Skip items that don't print well with AI artwork (embroidery, structured accessories)
      const SKIP = ['embroidered','embroidery','structured cap','snapback','baseball cap','bucket hat','trucker hat','dad hat','socks','underwear','leggings','swimwear','mask','apron']
      const filtered = (data.products || []).filter(p =>
        !SKIP.some(kw => (p.model || '').toLowerCase().includes(kw))
      )
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
      const h    = await getAuthHeader()
      const res  = await fetch(`/api/printful?action=catalogProduct&id=${p.id}`, { headers: h })
      const data = await res.json()
      const variants = data.variants || []

      // Build color map
      const colorMap = {}
      for (const v of variants) {
        const name = v.color || 'Default'
        if (!colorMap[name]) colorMap[name] = { name, hex: v.color_code || '#888', variantIds: [], image: v.image || p.image || '' }
        colorMap[name].variantIds.push(v.id)
        if (v.image && !colorMap[name].image) colorMap[name].image = v.image
      }
      const colors = Object.values(colorMap)
      setAvailableColors(colors)

      // Smart defaults: White + Black if available, else first two
      const white = colors.find(c => c.name.toLowerCase() === 'white')
      const black = colors.find(c => c.name.toLowerCase() === 'black')
      const defaults = [white, black].filter(Boolean)
      if (!defaults.length) defaults.push(...colors.slice(0, 2))
      setSelectedColors(defaults.map(c => c.name))
      const preview = white || defaults[0]
      if (preview) setPreviewColor(preview)
      setSelected({ ...p, variants })
    } catch {}
    setVariantLoading(false)
  }

  const toggleColor = (color) => {
    setSelectedColors(prev =>
      prev.includes(color.name) ? prev.filter(c => c !== color.name) : [...prev, color.name]
    )
    setPreviewColor(color)
  }

  const selectPopularColors = () => {
    const popular = availableColors.filter(c =>
      ['white','black','navy','gray','grey','heather gray','sport grey','charcoal','dark heather']
        .some(k => c.name.toLowerCase().includes(k))
    )
    setSelectedColors((popular.length ? popular : availableColors.slice(0, 3)).map(c => c.name))
  }

  const generateMockup = async () => {
    if (!previewColor || !hostedImageUrl || !selected) return
    setMockupStatus('generating')
    try {
      const h    = await getAuthHeader()
      const res  = await fetch('/api/printful?action=mockupCreate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ catalogProductId: selected.id, variantIds: previewColor.variantIds.slice(0, 3), imageUrl: hostedImageUrl }),
      })
      const data = await res.json()
      if (data.task_key) pollMockup(data.task_key, null, 0)
      else setMockupStatus('failed')
    } catch { setMockupStatus('failed') }
  }

  const pollMockup = async (taskKey, productId, attempt = 0) => {
    if (attempt > 20) { setMockupStatus('failed'); return }
    try {
      const h    = await getAuthHeader()
      const res  = await fetch(`/api/printful?action=mockupStatus&taskKey=${encodeURIComponent(taskKey)}`, { headers: h })
      const data = await res.json()
      if (data.status === 'completed') {
        const url = data.mockups?.[0]?.mockup_url || data.mockups?.[0]?.url || ''
        if (url) {
          setMockupUrl(url); setMockupStatus('done')
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
    if (!title.trim())          return setError('Product title is required.')
    if (!hostedImageUrl)        return setError('No image available.')
    if (!selected)              return setError('Please select a product type.')
    if (!selectedColors.length) return setError('Please select at least one color.')
    const base   = getBaseCost(selected.model)
    const profit = calcProfit(price, base)
    if (profit && profit.earnings <= 0)
      return setError(`Price too low — minimum $${(profit.breakEven + 0.01).toFixed(2)} to cover costs.`)
    setError(''); setCreating(true)
    try {
      const { data: prof } = await supabase.from('profiles').select('subscription_tier').eq('id', user.id).single()
      const tier  = prof?.subscription_tier || 'free'
      const limit = await checkProductLimit(user.id, tier)
      if (!limit.allowed) {
        setError(`You've reached your ${limit.limit} product limit on the ${tier} plan.`)
        setCreating(false); return
      }
      const h    = await getAuthHeader()
      const colorObjs   = availableColors.filter(c => selectedColors.includes(c.name))
      const allVariants = colorObjs.flatMap(c => c.variantIds)
      const res  = await fetch('/api/printful?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ title, description, variantIds: allVariants, imageUrl: hostedImageUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error) || 'Printful error')
      const printfulId = data.id || data.sync_product?.id || ''
      const tagList    = tags.split(',').map(t => t.trim()).filter(Boolean)
      const { data: inserted } = await supabase.from('products').insert({
        user_id: user.id, artwork_id: artworkId || null,
        title, description, product_type: selected.type,
        price: parseFloat(price),
        printful_product_id: String(printfulId),
        printful_variant_ids: allVariants.map(String),
        mockup_url: mockupUrl || hostedImageUrl,
        tags: tagList,
      }).select().single()
      // Generate mockup in background if not already done
      if (!mockupUrl && colorObjs[0]) {
        const mRes = await fetch('/api/printful?action=mockupCreate', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({ catalogProductId: selected.id, variantIds: colorObjs[0].variantIds.slice(0, 3), imageUrl: hostedImageUrl }),
        })
        const mData = await mRes.json()
        if (mData.task_key) pollMockup(mData.task_key, inserted?.id, 0)
      }
      setStep(4)
    } catch (e) { setError(e.message) }
    setCreating(false)
  }

  // ── Filtered catalog ──────────────────────────────────────────
  const filtered = (() => {
    const q = search.trim().toLowerCase()
    if (q) {
      return catalog.filter(p => {
        const model = (p.model || '').toLowerCase()
        const type  = (p.type  || '').toLowerCase()
        // Direct match
        if (model.includes(q) || type.includes(q)) return true
        // Match via any category keyword
        return CATEGORIES.some(cat => cat.kw.some(kw => kw.includes(q)) && matchesCategory(p, cat))
      })
    }
    if (activeCategory) {
      const cat = CATEGORIES.find(c => c.label === activeCategory)
      return cat ? catalog.filter(p => matchesCategory(p, cat)) : []
    }
    return []
  })()

  const base   = selected ? getBaseCost(selected.model) : null
  const profit = base ? calcProfit(price, base) : null
  const profitColor = !profit ? C.muted : profit.earnings <= 0 ? C.red : profit.margin < 20 ? C.gold : C.teal

  const progressPct = step === 0 ? 5 : ((step - 1) / 3) * 100

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && step < 4 && onClose()}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text, margin: 0 }}>
              {step === 4 ? '✦ Product Created!' : 'Create a Product'}
            </h3>
            {step < 4 && <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>}
          </div>
          <div style={{ height: 3, background: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.teal})`, borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
          {step > 0 && step < 4 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
              {STEPS.slice(0,3).map((s, i) => (
                <span key={s} style={{ fontSize: 11, color: step > i+1 ? C.teal : step === i+1 ? C.accent : C.muted, fontWeight: step === i+1 ? 700 : 400 }}>
                  {step > i+1 ? '✓ ' : ''}{s}{i < 2 ? ' ·' : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 20px' }}>

          {/* Step 0: Uploading */}
          {step === 0 && <Spinner label="Uploading your artwork..." />}

          {/* Step 1: Product */}
          {step === 1 && (
            <div>
              {hostedImageUrl && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: `${C.teal}10`, border: `1px solid ${C.teal}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                  <img src={hostedImageUrl} alt="Artwork" style={{ width: 40, height: 40, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>Artwork ready — what would you like to print on?</div>
                </div>
              )}

              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>🔍</span>
                <input value={search} onChange={e => { setSearch(e.target.value); if (e.target.value) setActiveCategory(null) }}
                  placeholder='Search — "shirt", "mug", "all-over print", "phone case"...'
                  style={{ ...inp, paddingLeft: 34 }} />
                {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14 }}>✕</button>}
              </div>

              {/* Category chips with item counts */}
              {!search && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Browse by type</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {CATEGORIES.map(cat => {
                      const count = catalog.filter(p => matchesCategory(p, cat)).length
                      if (!count) return null
                      const isActive = activeCategory === cat.label
                      return (
                        <button key={cat.label} onClick={() => setActiveCategory(isActive ? null : cat.label)}
                          style={{ background: isActive ? `${C.accent}22` : C.bg, border: `1.5px solid ${isActive ? C.accent+'88' : C.border}`, borderRadius: 20, padding: '5px 12px', color: isActive ? C.accent : C.text, fontSize: 12, fontWeight: isActive ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}>
                          {cat.icon} {cat.label}
                          <span style={{ fontSize: 10, color: isActive ? C.accent : C.muted, marginLeft: 2 }}>({count})</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Results */}
              {catalogLoading ? <Spinner label="Loading catalog..." /> :
               !activeCategory && !search ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>👆</div>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 4 }}>Pick a category or search above</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{catalog.length}+ products from Printful</div>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 13, color: C.muted }}>No products found — try a different search</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
                    {filtered.length} product{filtered.length !== 1 ? 's' : ''}{activeCategory ? ` in ${activeCategory}` : ''}
                    {selected && <span style={{ color: C.accent, marginLeft: 8 }}>· {selected.model} selected ✓</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filtered.map(p => {
                      const isSel = selected?.id === p.id
                      const base  = getBaseCost(p.model)
                      return (
                        <div key={p.id} onClick={() => selectProduct(p)}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, background: isSel ? `${C.accent}15` : C.bg, border: `2px solid ${isSel ? C.accent : C.border}`, borderRadius: 12, padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseEnter={e => { if (!isSel) e.currentTarget.style.borderColor = C.accent+'44' }}
                          onMouseLeave={e => { if (!isSel) e.currentTarget.style.borderColor = C.border }}>
                          <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', background: '#f0f0f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {p.image ? <img src={p.image} alt={p.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>🎨</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: isSel ? C.accent : C.text, marginBottom: 2 }}>{p.model}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>Base ~${base.toFixed(2)} · Suggest ${suggestPrice(base)}</div>
                          </div>
                          {variantLoading && isSel
                            ? <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'cpspin 0.7s linear infinite', flexShrink: 0 }} />
                            : <div style={{ width: 22, height: 22, borderRadius: '50%', background: isSel ? C.accent : 'none', border: `2px solid ${isSel ? C.accent : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', flexShrink: 0 }}>
                                {isSel ? '✓' : ''}
                              </div>
                          }
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <style>{`@keyframes cpspin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* Step 2: Colors */}
          {step === 2 && (
            <div>
              {/* Product chip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
                {selected?.image && <img src={selected.image} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />}
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: C.text }}>{selected?.model}</div>
                <button onClick={() => { setStep(1); setSelected(null) }} style={{ background: 'none', border: 'none', fontSize: 11, color: C.muted, cursor: 'pointer' }}>Change ↩</button>
              </div>

              {/* Mockup preview */}
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: '#f5f5f5' }}>
                  {mockupStatus === 'generating' && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,11,20,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                      <Spinner label="Generating preview..." />
                    </div>
                  )}
                  {mockupStatus === 'done' && mockupUrl
                    ? <img src={mockupUrl} alt="Mockup" style={{ maxHeight: 220, maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                    : previewColor?.image
                    ? <img src={previewColor.image} alt={previewColor.name} style={{ maxHeight: 180, maxWidth: '100%', objectFit: 'contain', opacity: 0.85 }} />
                    : <div style={{ textAlign: 'center', padding: 24, color: C.muted }}>
                        <div style={{ fontSize: 32, marginBottom: 6 }}>🎨</div>
                        <div style={{ fontSize: 12 }}>Select a color to preview</div>
                      </div>
                  }
                </div>
                <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {previewColor && <span style={{ width: 12, height: 12, borderRadius: '50%', background: previewColor.hex, border: '1px solid rgba(255,255,255,0.25)', display: 'inline-block' }} />}
                    {previewColor?.name || 'No color selected'}
                  </div>
                  {previewColor && mockupStatus !== 'generating' && (
                    <button onClick={generateMockup} style={{ background: `${C.teal}20`, border: `1px solid ${C.teal}44`, borderRadius: 8, padding: '4px 12px', color: C.teal, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {mockupStatus === 'done' ? '↻ Regenerate' : '✦ Preview'}
                    </button>
                  )}
                </div>
              </div>

              {/* Colors */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {availableColors.length} colors — select all to offer
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    ['All', () => setSelectedColors(availableColors.map(c => c.name))],
                    ['Popular', selectPopularColors],
                    ['Clear', () => setSelectedColors([])],
                  ].map(([label, fn]) => (
                    <button key={label} onClick={fn} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '3px 9px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>{label}</button>
                  ))}
                </div>
              </div>

              {variantLoading ? <Spinner label="Loading colors..." /> : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {availableColors.map(color => {
                      const isSel  = selectedColors.includes(color.name)
                      const isPrev = previewColor?.name === color.name
                      return (
                        <button key={color.name} onClick={() => toggleColor(color)} title={color.name}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, background: isSel ? `${C.accent}18` : C.bg, border: `2px solid ${isPrev ? C.teal : isSel ? C.accent : C.border}`, borderRadius: 20, padding: '4px 10px 4px 6px', cursor: 'pointer', transition: 'all 0.12s' }}>
                          <span style={{ width: 13, height: 13, borderRadius: '50%', background: color.hex, border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: isSel ? C.accent : C.text, fontWeight: isSel ? 700 : 400, whiteSpace: 'nowrap' }}>{color.name}</span>
                          {isSel && <span style={{ fontSize: 9, color: C.accent }}>✓</span>}
                        </button>
                      )
                    })}
                  </div>
                  {selectedColors.length > 0 && (
                    <div style={{ background: `${C.teal}10`, border: `1px solid ${C.teal}33`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: C.teal, marginTop: 10 }}>
                      ✓ {selectedColors.length} color{selectedColors.length !== 1 ? 's' : ''}: {selectedColors.slice(0, 5).join(', ')}{selectedColors.length > 5 ? ` +${selectedColors.length - 5} more` : ''}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div>
              {/* Mini summary + AI Fill button */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', background: '#f0f0f0', flexShrink: 0 }}>
                  <img src={mockupUrl || hostedImageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{selected?.model}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{selectedColors.length} color{selectedColors.length !== 1 ? 's' : ''}: {selectedColors.slice(0, 4).join(', ')}{selectedColors.length > 4 ? ` +${selectedColors.length - 4}` : ''}</div>
                </div>
                <button onClick={generateProductDetails} disabled={aiDetailsLoading}
                  title="Let Dream AI write your title, description and tags"
                  style={{ background: aiDetailsLoading ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '7px 12px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: aiDetailsLoading ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                  {aiDetailsLoading ? '✦ Writing...' : '✦ AI Fill'}
                </button>
              </div>

              {/* AI loading banner */}
              {aiDetailsLoading && (
                <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: C.accent, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>✦</span>
                  Dream AI is writing your product title, description and tags...
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Title */}
                <div>
                  <label style={lbl}>Product Title</label>
                  <input value={title} onChange={e => { setTitle(e.target.value); setTitleTouched(true) }}
                    maxLength={100} style={inp} placeholder="e.g. Cosmic Eagle All-Over Print T-Shirt" />
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Include art style + product type for better discoverability</div>
                </div>

                {/* Description */}
                <div>
                  <label style={lbl}>Description <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={500}
                    style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
                    placeholder="What makes this product special?" />
                </div>

                {/* Tags */}
                <div>
                  <label style={lbl}>Style Tags</label>
                  <input value={tags} onChange={e => setTags(e.target.value)}
                    placeholder="e.g. cyberpunk, neon, squirrel, fantasy" style={inp} />
                  {tags.trim() && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                      {tags.split(',').map(t => t.trim()).filter(Boolean).map((t, i) => (
                        <span key={i} style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}33`, borderRadius: 20, padding: '2px 8px', fontSize: 10, color: C.accent }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Price + live profit calculator */}
                <div>
                  <label style={lbl}>Retail Price (USD)</label>
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }}>$</span>
                    <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="5" step="0.01"
                      style={{ ...inp, paddingLeft: 26 }} />
                  </div>
                  {base && (
                    <div style={{ background: C.card, border: `1px solid ${profit && profit.earnings <= 0 ? C.red+'44' : C.border}`, borderRadius: 12, padding: '12px 16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 6 }}>
                        {[
                          ['Printful cost', `$${base.toFixed(2)}`, C.muted],
                          ['Fees (10% + ~3%)', price ? `$${((parseFloat(price)||0)*0.13+0.30).toFixed(2)}` : '—', C.muted],
                          ['Your earnings', profit ? `$${profit.earnings.toFixed(2)}` : '—', profitColor],
                        ].map(([label, val, color]) => (
                          <div key={label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color }}>{val}</div>
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, textAlign: 'center', color: profitColor }}>
                        {profit && profit.earnings <= 0
                          ? `⚠️ Raise price to at least $${(profit.breakEven + 0.01).toFixed(2)} to make a profit`
                          : profit ? `${profit.margin.toFixed(0)}% margin · Suggested: $${suggestPrice(base)}`
                          : `Suggested price: $${suggestPrice(base)}`}
                      </div>
                    </div>
                  )}
                </div>

                {error && <div style={{ background: `${C.red}12`, border: `1px solid ${C.red}33`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.red }}>{error}</div>}
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, marginBottom: 8 }}>Product Created!</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 6 }}>
                <strong style={{ color: C.text }}>{title}</strong> is now live with {selectedColors.length} color{selectedColors.length !== 1 ? 's' : ''}.
              </p>
              {mockupStatus === 'generating' && (
                <p style={{ fontSize: 12, color: C.gold, marginBottom: 16 }}>✦ Mockup preview is still generating — it'll appear shortly.</p>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
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
        {step > 0 && step < 4 && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 18px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>
                ← Back
              </button>
            )}
            <div style={{ flex: 1 }} />
            {step === 1 && (
              <button onClick={() => selected && !variantLoading && setStep(2)} disabled={!selected || variantLoading}
                style={{ background: !selected || variantLoading ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: !selected || variantLoading ? 'not-allowed' : 'pointer' }}>
                {variantLoading ? 'Loading...' : selected ? 'Choose Colors →' : 'Select a product first'}
              </button>
            )}
            {step === 2 && (
              <button onClick={() => selectedColors.length > 0 && setStep(3)} disabled={selectedColors.length === 0}
                style={{ background: selectedColors.length === 0 ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: selectedColors.length === 0 ? 'not-allowed' : 'pointer' }}>
                {selectedColors.length === 0 ? 'Select at least one color' : 'Add Details →'}
              </button>
            )}
            {step === 3 && (
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
