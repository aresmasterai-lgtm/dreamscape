import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getColorHex, formatColorName, groupColorsByFamily } from '../lib/colorMap'

let _catalogCache = null
let _catalogCacheTime = 0
const CATALOG_TTL = 30 * 60 * 1000

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
  const raw = base / (1 - 0.38)
  return (Math.ceil(raw) - 0.01).toFixed(2)
}

function buildPrintifyColors(variants, fallbackImage = '') {
  const SIZES = ['xs','s','m','l','xl','2xl','3xl','4xl','5xl','one size','os','6xl']
  const colorMap = {}
  for (const v of variants) {
    let colorName = null
    if (Array.isArray(v.options)) {
      const colorOpt = v.options.find(o =>
        (o.type || '').toLowerCase() === 'color' ||
        (o.title || '').toLowerCase().includes('color')
      )
      colorName = colorOpt?.title || colorOpt?.value || null
    }
    if (!colorName && v.title) {
      const parts = v.title.split('/').map(s => s.trim())
      const nonSize = parts.find(p => !SIZES.includes(p.toLowerCase()))
      colorName = nonSize || parts[parts.length - 1]
    }
    if (!colorName) colorName = 'Default'
    const display = formatColorName(colorName)
    if (!colorMap[display]) {
      colorMap[display] = { name: display, hex: getColorHex(colorName), variantIds: [], image: fallbackImage }
    }
    colorMap[display].variantIds.push(v.id)
  }
  return Object.values(colorMap)
}

const CATEGORY_GROUPS = [
  {
    group: 'Wall Art & Prints', featured: true,
    categories: [
      { label: 'Canvas Prints',  kw: ['canvas print','gallery wrapped','stretched canvas','canvas wrap','canvas art'] },
      { label: 'Framed Prints',  kw: ['framed poster','framed print','wood framed','framed art','framed canvas'] },
      { label: 'Metal Prints',   kw: ['metal print','aluminum print','dibond','chromaluxe'] },
      { label: 'Acrylic Prints', kw: ['acrylic print','acrylic'] },
      { label: 'Wood Prints',    kw: ['wood print','wood art'] },
      { label: 'Posters',        kw: ['poster','matte poster','glossy poster','photo print','art print'] },
    ]
  },
  {
    group: 'Apparel',
    categories: [
      { label: 'T-Shirts',    kw: ['t-shirt','tee','jersey','cotton tee','unisex t','classic t','heavy t','bella','next level','soft style','ring spun','comfort colors'] },
      { label: 'Hoodies',     kw: ['hoodie','sweatshirt','pullover','crewneck','crew neck','fleece','quarter zip'] },
      { label: 'Long Sleeve', kw: ['long sleeve','longsleeve','long-sleeve'] },
      { label: 'Tank Tops',   kw: ['tank','racerback','sleeveless','muscle shirt','jersey tank'] },
      { label: 'All-Over',    kw: ['all-over','allover','aop','cut & sew','sublimation'] },
      { label: 'Kids',        kw: ['kids','youth','toddler','baby','onesie','children','infant','romper'] },
    ]
  },
  {
    group: 'Home & Living',
    categories: [
      { label: 'Pillows',    kw: ['pillow','cushion','throw pillow','accent pillow'] },
      { label: 'Blankets',   kw: ['blanket','throw','sherpa','fleece blanket'] },
      { label: 'Mugs',       kw: ['mug','cup','ceramic','latte','travel mug'] },
      { label: 'Tapestries', kw: ['tapestry','wall hanging','wall tapestry'] },
    ]
  },
  {
    group: 'Accessories',
    categories: [
      { label: 'Phone Cases', kw: ['phone case','iphone','samsung','snap case','tough case','clear case','galaxy'] },
      { label: 'Tote Bags',   kw: ['tote','canvas bag','grocery bag','shopping bag'] },
      { label: 'Hats',        kw: ['hat','cap','beanie','snapback','trucker','dad hat','bucket hat','fitted'] },
      { label: 'Stickers',    kw: ['sticker','decal','die cut','vinyl sticker','kiss cut'] },
    ]
  },
]
const CATEGORIES = CATEGORY_GROUPS.flatMap(g => g.categories)

function matchesCategory(p, cat) {
  const model = (p.model || '').toLowerCase()
  const type  = (p.type  || '').toLowerCase()
  return cat.kw.some(kw => model.includes(kw) || type.includes(kw))
}
function matchesGroup(p, group) {
  return group.categories.some(cat => matchesCategory(p, cat))
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

function ColorSwatch({ color, isSelected, isPreviewing, onClick }) {
  const r = parseInt((color.hex || '#888888').slice(1,3),16)
  const g = parseInt((color.hex || '#888888').slice(3,5),16)
  const b = parseInt((color.hex || '#888888').slice(5,7),16)
  const lum = (0.299*r + 0.587*g + 0.114*b)/255
  const isLight = lum > 0.75
  return (
    <button onClick={() => onClick(color)} title={color.name}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: '4px', cursor: 'pointer', borderRadius: 8, transition: 'transform 0.12s', outline: 'none' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: color.hex || '#888888',
        border: isPreviewing ? `3px solid ${C.teal}` : isSelected ? `3px solid ${C.accent}` : isLight ? `2px solid rgba(0,0,0,0.15)` : `2px solid rgba(255,255,255,0.12)`,
        boxShadow: isPreviewing ? `0 0 0 2px ${C.teal}44, 0 2px 8px rgba(0,0,0,0.4)` : isSelected ? `0 0 0 2px ${C.accent}44, 0 2px 8px rgba(0,0,0,0.4)` : `0 2px 6px rgba(0,0,0,0.3)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0,
      }}>
        {isSelected && <span style={{ fontSize: 13, color: lum > 0.5 ? '#000' : '#fff', fontWeight: 900, lineHeight: 1 }}>✓</span>}
      </div>
      <span style={{ fontSize: 9, color: isSelected ? C.accent : C.muted, fontWeight: isSelected ? 700 : 400, textAlign: 'center', maxWidth: 50, lineHeight: 1.2, wordBreak: 'break-word' }}>
        {color.name}
      </span>
    </button>
  )
}

function SizeChip({ option, isSelected, onClick }) {
  return (
    <button onClick={() => onClick(option)}
      style={{ background: isSelected ? `${C.accent}20` : C.bg, border: `2px solid ${isSelected ? C.accent : C.border}`, borderRadius: 10, padding: '7px 14px', color: isSelected ? C.accent : C.text, fontSize: 12, fontWeight: isSelected ? 700 : 400, cursor: 'pointer', transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: 4 }}>
      {isSelected && <span style={{ fontSize: 10 }}>✓</span>}
      {option.name}
    </button>
  )
}

const STEPS = ['Product', 'Colors', 'Details', 'Done']

export default function CreateProductModal({ user, imageUrl, artworkId, title: defaultTitle, onClose, onSuccess }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(imageUrl?.startsWith('data:') ? 0 : 1)
  const [hostedImageUrl, setHostedImageUrl] = useState(imageUrl?.startsWith('data:') ? '' : (imageUrl || ''))
  const [catalog, setCatalog]               = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [selected, setSelected]             = useState(null)
  const [variantLoading, setVariantLoading] = useState(false)
  const [search, setSearch]                 = useState('')
  const [activeCategory, setActiveCategory] = useState(null)
  const [availableColors, setAvailableColors] = useState([])
  const [selectedColors, setSelectedColors]   = useState([])
  const [previewColor, setPreviewColor]       = useState(null)
  const [mockupStatus, setMockupStatus]       = useState('idle')
  const [mockupUrl, setMockupUrl]             = useState('')
  const [colorGroupExpanded, setColorGroupExpanded] = useState({})
  const [colorView, setColorView]             = useState('swatches')
  const mockupPollRef = useRef(null)
  const [title, setTitle]               = useState(defaultTitle || '')
  const [titleTouched, setTitleTouched] = useState(false)
  const [description, setDescription]   = useState('')
  const [price, setPrice]               = useState('')
  const [tags, setTags]                 = useState('')
  const [creating, setCreating]         = useState(false)
  const [error, setError]               = useState('')
  const [aiDetailsLoading, setAiDetailsLoading] = useState(false)

  const inp = { width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }

  useEffect(() => {
    loadCatalog()
    if (imageUrl?.startsWith('data:')) uploadDataUrl(imageUrl)
    return () => { if (mockupPollRef.current) clearTimeout(mockupPollRef.current) }
  }, [])
  useEffect(() => { if (selected && !titleTouched) setTitle(`${defaultTitle || 'My Design'} — ${selected.model}`) }, [selected])
  useEffect(() => { if (selected && !price) setPrice(suggestPrice(getBaseCost(selected.model))) }, [selected])
  useEffect(() => {
    if (step !== 3 || aiDetailsLoading) return
    if (titleTouched || description.trim() || tags.trim()) return
    generateProductDetails()
  }, [step])

  const generateProductDetails = async () => {
    if (!selected) return
    setAiDetailsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/dream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ messages: [{ role: 'user', content: `You are a product copywriter for an AI art store. Generate listing details for a ${selected.type || selected.model} featuring this artwork: "${defaultTitle || 'AI generated artwork'}". Reply with ONLY a valid JSON object, no markdown: {"title":"catchy product title max 80 chars","description":"2 engaging sentences about this product","tags":"tag1,tag2,tag3,tag4,tag5"}` }] })
      })
      const data = await res.json()
      const jsonMatch = (data.reply || '').match(/\{[^{}]*"title"[^{}]*"description"[^{}]*"tags"[^{}]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.title)       { setTitle(parsed.title); setTitleTouched(true) }
          if (parsed.description) setDescription(parsed.description)
          if (parsed.tags)        setTags(parsed.tags)
        } catch {}
      }
    } catch {}
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
      setHostedImageUrl(publicUrl); setStep(1)
    } catch (e) { setError('Upload failed: ' + e.message); setStep(1) }
  }

  const loadCatalog = async () => {
    setCatalogLoading(true)
    try {
      const now = Date.now()
      if (_catalogCache && (now - _catalogCacheTime) < CATALOG_TTL) { setCatalog(_catalogCache); setCatalogLoading(false); return }
      const h = await getAuthHeader()
      const res  = await fetch('/api/catalog', { headers: h })
      const data = await res.json()
      const products = data.products || []
      _catalogCache = products; _catalogCacheTime = now
      setCatalog(products)
    } catch {}
    setCatalogLoading(false)
  }

  const applySmartDefaults = (colors) => {
    const white = colors.find(c => c.name.toLowerCase() === 'white')
    const black = colors.find(c => c.name.toLowerCase() === 'black')
    const defaults = [white, black].filter(Boolean)
    if (!defaults.length) defaults.push(...colors.slice(0, 2))
    setSelectedColors(defaults.map(c => c.name))
    if (defaults[0]) setPreviewColor(defaults[0])
  }

  const selectProduct = async (p) => {
    setSelected(p); setAvailableColors([]); setSelectedColors([]); setPreviewColor(null)
    setMockupUrl(''); setMockupStatus('idle'); setColorGroupExpanded({}); setVariantLoading(true)
    try {
      const h = await getAuthHeader()
      if (p.provider === 'printify') {
        const blueprintId = p.raw_id || String(p.id).replace('py_', '').replace('printify_', '')
        const res  = await fetch(`/api/printify?action=catalogProduct&id=${blueprintId}`, { headers: h })
        const data = await res.json()
        let colors = []
        if (data.colors && data.colors.length > 0) {
          colors = data.colors.map(c => ({ ...c, name: formatColorName(c.name), hex: c.hex === '#888888' ? getColorHex(c.name) : c.hex }))
        } else if (data.variants && data.variants.length > 0) {
          colors = buildPrintifyColors(data.variants, p.image || '')
        }
        setAvailableColors(colors); applySmartDefaults(colors)
        setSelected({ ...p, variants: data.variants || [], printify_provider_id: data.print_provider_id || null, provider: 'printify' })
      } else {
        const res = await fetch(`/api/printful?action=catalogProduct&id=${p.raw_id || p.id}`, { headers: h })
        const data = await res.json()
        const variants = data.variants || []
        const hasColors = variants.some(v => v.color && v.color.trim())
        const variantMap = {}
        if (hasColors) {
          for (const v of variants) {
            const rawName = v.color || 'Default'
            const display = formatColorName(rawName)
            if (!variantMap[display]) variantMap[display] = { name: display, hex: v.color_code || v.color_code2 || getColorHex(rawName), variantIds: [], image: v.image || p.image || '', isSize: false }
            variantMap[display].variantIds.push(v.id)
            if (v.image && !variantMap[display].image) variantMap[display].image = v.image
          }
        } else {
          for (const v of variants) {
            const name = v.size || v.name || `Option ${v.id}`
            if (!variantMap[name]) variantMap[name] = { name, hex: '#7C5CFC', variantIds: [], image: v.image || p.image || '', isSize: true }
            variantMap[name].variantIds.push(v.id)
          }
        }
        const options = Object.values(variantMap)
        setAvailableColors(options)
        if (hasColors) {
          applySmartDefaults(options)
        } else {
          const popularSizes = ['11×14','12×16','16×20','18×24','24×36','12×12','16×16']
          const defaults = options.filter(o => popularSizes.some(s => o.name.replace(/\s/g,'').includes(s.replace(/\s/g,''))))
          const sel = defaults.length ? defaults : options.slice(0, 3)
          setSelectedColors(sel.map(c => c.name))
          if (options[0]) setPreviewColor(options[0])
        }
        setSelected({ ...p, variants, isWallArt: !hasColors, provider: 'printful' })
      }
    } catch (e) { console.error('selectProduct error:', e.message) }
    setVariantLoading(false)
  }

  const toggleColor = (color) => {
    setSelectedColors(prev => prev.includes(color.name) ? prev.filter(c => c !== color.name) : [...prev, color.name])
    setPreviewColor(color)
  }

  const selectPopularColors = () => {
    if (availableColors[0]?.isSize) {
      const popularSizes = ['11×14','12×16','16×20','18×24','24×36','12×12','16×16']
      const popular = availableColors.filter(o => popularSizes.some(s => o.name.replace(/\s/g,'').includes(s.replace(/\s/g,''))))
      setSelectedColors((popular.length ? popular : availableColors.slice(0, 3)).map(c => c.name))
    } else {
      const popularNames = ['white','black','navy','gray','grey','heather gray','sport grey','charcoal','dark heather']
      const popular = availableColors.filter(c => popularNames.some(k => c.name.toLowerCase().includes(k)))
      setSelectedColors((popular.length ? popular : availableColors.slice(0, 3)).map(c => c.name))
    }
  }

  const generateMockup = async () => {
    if (!previewColor || !hostedImageUrl || !selected) return
    if (selected.provider === 'printify') {
      const previewImg = previewColor.image || selected.image || ''
      if (previewImg) { setMockupUrl(previewImg); setMockupStatus('done') } else setMockupStatus('failed')
      return
    }
    setMockupStatus('generating')
    try {
      const h   = await getAuthHeader()
      const res = await fetch('/api/printful?action=mockupCreate', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify({ catalogProductId: selected.raw_id || selected.id, variantIds: previewColor.variantIds.slice(0, 3), imageUrl: hostedImageUrl }) })
      const data = await res.json()
      if (data.task_key) pollMockup(data.task_key, null, 0)
      else setMockupStatus('failed')
    } catch { setMockupStatus('failed') }
  }

  const pollMockup = async (taskKey, productId, attempt = 0) => {
    if (attempt > 20) { setMockupStatus('failed'); return }
    try {
      const h   = await getAuthHeader()
      const res = await fetch(`/api/printful?action=mockupStatus&taskKey=${encodeURIComponent(taskKey)}`, { headers: h })
      const data = await res.json()
      if (data.status === 'completed') {
        const url = data.mockups?.[0]?.mockup_url || data.mockups?.[0]?.url || ''
        if (url) {
          setMockupUrl(url); setMockupStatus('done')
          if (productId) await supabase.from('products').update({ mockup_url: url }).eq('id', productId)
        } else setMockupStatus('failed')
      } else if (data.status === 'failed') { setMockupStatus('failed') }
      else mockupPollRef.current = setTimeout(() => pollMockup(taskKey, productId, attempt + 1), 3000)
    } catch { mockupPollRef.current = setTimeout(() => pollMockup(taskKey, productId, attempt + 1), 3000) }
  }

  const handleCreate = async () => {
    if (!title.trim())          return setError('Product title is required.')
    if (!hostedImageUrl)        return setError('No image available.')
    if (!selected)              return setError('Please select a product type.')
    if (!selectedColors.length) return setError('Please select at least one color.')
    const base   = getBaseCost(selected.model)
    const profit = calcProfit(price, base)
    if (profit && profit.earnings <= 0) return setError(`Price too low — minimum $${(profit.breakEven + 0.01).toFixed(2)} to break even.`)
    setError(''); setCreating(true)
    try {
      const { data: prof } = await supabase.from('profiles').select('subscription_tier').eq('id', user.id).single()
      const tier  = prof?.subscription_tier || 'free'
      const limit = await checkProductLimit(user.id, tier)
      if (!limit.allowed) { setError(`You've reached your ${limit.limit} product limit on the ${tier} plan.`); setCreating(false); return }

      const h           = await getAuthHeader()
      const colorObjs   = availableColors.filter(c => selectedColors.includes(c.name))
      const allVariants  = colorObjs.flatMap(c => c.variantIds)
      const isPrintify   = selected.provider === 'printify'
      let externalProductId = ''

      if (isPrintify) {
        const res = await fetch('/api/printify?action=create_product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({
            blueprint_id: selected.raw_id,
            print_provider_id: selected.printify_provider_id,
            variants: colorObjs.flatMap(c => c.variantIds.map(id => ({ id, price: Math.round(parseFloat(price) * 100) }))),
            image_url: hostedImageUrl,
            title,
            description,
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Printify creation failed')
        externalProductId = data.product_id || ''
      } else {
        const res = await fetch('/api/printful?action=create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({ title, description, variantIds: allVariants, imageUrl: hostedImageUrl })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error) || 'Creation failed')
        externalProductId = String(data.id || data.sync_product?.id || '')
      }

      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)

      // ── Save to Supabase ─────────────────────────────────────────────────
      const insertPayload = {
        user_id:              user.id,
        artwork_id:           artworkId || null,
        title,
        description,
        product_type:         selected.type || selected.model,
        price:                parseFloat(price),
        printful_product_id:  isPrintify ? null : externalProductId,
        printify_product_id:  isPrintify ? externalProductId : null,
        printful_variant_ids: isPrintify ? [] : allVariants.map(String),
        mockup_url:           mockupUrl || hostedImageUrl,
        tags:                 tagList,
      }

      const { data: inserted, error: insertError } = await supabase
        .from('products')
        .insert(insertPayload)
        .select()
        .single()

      if (insertError) throw new Error('Failed to save product: ' + insertError.message)

      // ── Generate Printful mockup async after save ────────────────────────
      if (!isPrintify && !mockupUrl && colorObjs[0]) {
        const mRes = await fetch('/api/printful?action=mockupCreate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({ catalogProductId: selected.raw_id || selected.id, variantIds: colorObjs[0].variantIds.slice(0, 3), imageUrl: hostedImageUrl })
        })
        const mData = await mRes.json()
        if (mData.task_key) pollMockup(mData.task_key, inserted?.id, 0)
      }

      setStep(4)
    } catch (e) { setError(e.message) }
    setCreating(false)
  }

  const filtered = (() => {
    const q = search.trim().toLowerCase()
    if (q) return catalog.filter(p => { const model = (p.model || '').toLowerCase(); const type = (p.type || '').toLowerCase(); if (model.includes(q) || type.includes(q)) return true; return CATEGORIES.some(cat => cat.kw.some(kw => kw.includes(q)) && matchesCategory(p, cat)) })
    if (activeCategory) { const cat = CATEGORIES.find(c => c.label === activeCategory); return cat ? catalog.filter(p => matchesCategory(p, cat)) : [] }
    return []
  })()

  const base        = selected ? getBaseCost(selected.model) : null
  const profit      = base ? calcProfit(price, base) : null
  const profitColor = !profit ? C.muted : profit.earnings <= 0 ? C.red : profit.margin < 20 ? C.gold : C.teal
  const progressPct = step === 0 ? 5 : ((step - 1) / 3) * 100
  const isWallArt   = availableColors[0]?.isSize
  const colorGroups = (!isWallArt && availableColors.length > 0) ? groupColorsByFamily(availableColors) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && step < 4 && onClose()}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 660, maxHeight: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <style>{`@keyframes cpspin{to{transform:rotate(360deg)}}`}</style>

        {/* Header */}
        <div style={{ padding: '18px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text, margin: 0 }}>{step === 4 ? '✦ Product Live!' : 'Sell Your Art'}</h3>
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
          {step === 0 && <Spinner label="Preparing your artwork..." />}

          {/* Step 1: Product selection */}
          {step === 1 && (
            <div>
              {hostedImageUrl && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: `${C.teal}10`, border: `1px solid ${C.teal}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                  <img src={hostedImageUrl} alt="Artwork" style={{ width: 40, height: 40, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>Artwork ready — choose what to print it on</div>
                </div>
              )}
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 14 }}>🔍</span>
                <input value={search} onChange={e => { setSearch(e.target.value); if (e.target.value) setActiveCategory(null) }} placeholder='Search — "shirt", "mug", "canvas", "phone case"...' style={{ ...inp, paddingLeft: 34 }} />
                {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14 }}>✕</button>}
              </div>
              {!search && (
                <div style={{ marginBottom: 14 }}>
                  {CATEGORY_GROUPS.map(group => {
                    const groupCount = catalog.filter(p => matchesGroup(p, group)).length
                    if (!groupCount) return null
                    return (
                      <div key={group.group} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: group.featured ? C.accent : C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{group.featured ? '✦ ' : ''}{group.group}</div>
                          <div style={{ flex: 1, height: 1, background: C.border }} />
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {group.categories.map(cat => {
                            const count = catalog.filter(p => matchesCategory(p, cat)).length
                            if (!count) return null
                            const isActive = activeCategory === cat.label
                            return (
                              <button key={cat.label} onClick={() => setActiveCategory(isActive ? null : cat.label)}
                                style={{ background: isActive ? `${C.accent}22` : C.bg, border: `1.5px solid ${isActive ? C.accent+'88' : C.border}`, borderRadius: 20, padding: '5px 14px', color: isActive ? C.accent : C.text, fontSize: 12, fontWeight: isActive ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                                {cat.label} <span style={{ fontSize: 10, color: isActive ? C.accent : C.muted, marginLeft: 4 }}>({count})</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {catalogLoading ? <Spinner label="Loading products..." /> : !activeCategory && !search ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>✦ Best for AI Artwork</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    {[
                      { label: 'Canvas Prints',  icon: '🎨', desc: 'Gallery-quality wall art' },
                      { label: 'Framed Prints',  icon: '🖼',  desc: 'Ready to hang' },
                      { label: 'Metal Prints',   icon: '✨', desc: 'Ultra-vivid & modern' },
                      { label: 'Posters',        icon: '📜', desc: 'Affordable & sharp' },
                      { label: 'Acrylic Prints', icon: '💎', desc: 'Luxury glass-like finish' },
                      { label: 'T-Shirts',       icon: '👕', desc: 'All-over print or centered' },
                    ].map(item => {
                      const cat = CATEGORIES.find(c => c.label === item.label)
                      const count = cat ? catalog.filter(p => matchesCategory(p, cat)).length : 0
                      return (
                        <button key={item.label} onClick={() => { const m = CATEGORIES.find(c => c.label === item.label); if (m) setActiveCategory(m.label) }}
                          style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = C.accent+'66'} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                          <div style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 2 }}>{item.label}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>{item.desc}</div>
                          {count > 0 && <div style={{ fontSize: 10, color: C.accent, marginTop: 4 }}>{count} options</div>}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ textAlign: 'center', paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12, color: C.muted }}>{catalog.length} total products · shipped worldwide</div>
                  </div>
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
                          onMouseEnter={e => { if (!isSel) e.currentTarget.style.borderColor = C.accent+'44' }} onMouseLeave={e => { if (!isSel) e.currentTarget.style.borderColor = C.border }}>
                          <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', background: '#f0f0f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {p.image ? <img src={p.image} alt={p.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>🎨</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: isSel ? C.accent : C.text, marginBottom: 2 }}>{p.model}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>Base ~${base.toFixed(2)} · Suggested ${suggestPrice(base)}</div>
                          </div>
                          {variantLoading && isSel
                            ? <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'cpspin 0.7s linear infinite', flexShrink: 0 }} />
                            : <div style={{ width: 22, height: 22, borderRadius: '50%', background: isSel ? C.accent : 'none', border: `2px solid ${isSel ? C.accent : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', flexShrink: 0 }}>{isSel ? '✓' : ''}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Colors */}
          {step === 2 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
                {selected?.image && <img src={selected.image} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />}
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: C.text }}>{selected?.model}</div>
                <button onClick={() => { setStep(1); setSelected(null) }} style={{ background: 'none', border: 'none', fontSize: 11, color: C.muted, cursor: 'pointer' }}>Change ↩</button>
              </div>

              {/* Preview */}
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: '#f5f5f5' }}>
                  {mockupStatus === 'generating' && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,11,20,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                      <Spinner label="Generating preview..." />
                    </div>
                  )}
                  {mockupStatus === 'done' && mockupUrl
                    ? <img src={mockupUrl} alt="Preview" style={{ maxHeight: 220, maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                    : previewColor?.image
                    ? <img src={previewColor.image} alt={previewColor.name} style={{ maxHeight: 180, maxWidth: '100%', objectFit: 'contain', opacity: 0.85 }} />
                    : <div style={{ textAlign: 'center', padding: 24, color: C.muted }}><div style={{ fontSize: 32, marginBottom: 6 }}>🎨</div><div style={{ fontSize: 12 }}>Select a color to preview</div></div>}
                </div>
                <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {previewColor && !isWallArt && <span style={{ width: 16, height: 16, borderRadius: '50%', background: previewColor.hex, border: '2px solid rgba(255,255,255,0.2)', display: 'inline-block', flexShrink: 0 }} />}
                    {previewColor?.name || 'No color selected'}
                  </div>
                  {previewColor && mockupStatus !== 'generating' && !isWallArt && (
                    <button onClick={generateMockup} style={{ background: `${C.teal}20`, border: `1px solid ${C.teal}44`, borderRadius: 8, padding: '4px 12px', color: C.teal, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {mockupStatus === 'done' ? '↻ Regenerate' : '✦ Preview'}
                    </button>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {isWallArt ? `${availableColors.length} sizes` : `${availableColors.length} colors`}
                  {selectedColors.length > 0 && <span style={{ color: C.accent, marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>· {selectedColors.length} selected</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!isWallArt && (
                    <button onClick={() => setColorView(v => v === 'swatches' ? 'list' : 'swatches')}
                      style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '3px 9px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>
                      {colorView === 'swatches' ? '☰' : '⬛'}
                    </button>
                  )}
                  {[['All', () => setSelectedColors(availableColors.map(c => c.name))], ['Popular', selectPopularColors], ['Clear', () => setSelectedColors([])]].map(([label, fn]) => (
                    <button key={label} onClick={fn} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '3px 9px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>{label}</button>
                  ))}
                </div>
              </div>

              {variantLoading ? <Spinner label="Loading options..." /> : isWallArt ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {availableColors.map(option => (
                    <SizeChip key={option.name} option={option} isSelected={selectedColors.includes(option.name)} onClick={c => { toggleColor(c); setPreviewColor(c) }} />
                  ))}
                </div>
              ) : colorView === 'swatches' ? (
                <div>
                  {colorGroups && Object.entries(colorGroups).map(([family, colors]) => {
                    const isExpanded = colorGroupExpanded[family] !== false
                    const selectedInGroup = colors.filter(c => selectedColors.includes(c.name)).length
                    return (
                      <div key={family} style={{ marginBottom: 14 }}>
                        <button onClick={() => setColorGroupExpanded(prev => ({ ...prev, [family]: !isExpanded }))}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', marginBottom: isExpanded ? 8 : 0, padding: '2px 0' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{family}</span>
                          <span style={{ fontSize: 10, color: C.muted }}>({colors.length})</span>
                          {selectedInGroup > 0 && <span style={{ fontSize: 10, color: C.accent, fontWeight: 700 }}>· {selectedInGroup} ✓</span>}
                          <div style={{ flex: 1, height: 1, background: C.border }} />
                          <span style={{ fontSize: 10, color: C.muted }}>{isExpanded ? '▲' : '▼'}</span>
                        </button>
                        {isExpanded && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                            {colors.map(color => (
                              <ColorSwatch key={color.name} color={color} isSelected={selectedColors.includes(color.name)} isPreviewing={previewColor?.name === color.name} onClick={toggleColor} />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {availableColors.map(color => {
                    const isSel  = selectedColors.includes(color.name)
                    const isPrev = previewColor?.name === color.name
                    return (
                      <button key={color.name} onClick={() => toggleColor(color)} title={color.name}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: isSel ? `${C.accent}18` : C.bg, border: `2px solid ${isPrev ? C.teal : isSel ? C.accent : C.border}`, borderRadius: 20, padding: '4px 10px 4px 6px', cursor: 'pointer', transition: 'all 0.12s' }}>
                        <span style={{ width: 14, height: 14, borderRadius: '50%', background: color.hex, border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: isSel ? C.accent : C.text, fontWeight: isSel ? 700 : 400, whiteSpace: 'nowrap' }}>{color.name}</span>
                        {isSel && <span style={{ fontSize: 9, color: C.accent }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}

              {selectedColors.length > 0 && (
                <div style={{ background: `${C.teal}10`, border: `1px solid ${C.teal}33`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: C.teal, marginTop: 12 }}>
                  ✓ {selectedColors.length} {isWallArt ? 'size' : 'color'}{selectedColors.length !== 1 ? 's' : ''}: {selectedColors.slice(0, 5).join(', ')}{selectedColors.length > 5 ? ` +${selectedColors.length - 5} more` : ''}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', background: '#f0f0f0', flexShrink: 0 }}>
                  <img src={mockupUrl || hostedImageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{selected?.model}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{selectedColors.length} {isWallArt ? 'size' : 'color'}{selectedColors.length !== 1 ? 's' : ''}: {selectedColors.slice(0, 4).join(', ')}{selectedColors.length > 4 ? ` +${selectedColors.length - 4}` : ''}</div>
                </div>
                <button onClick={generateProductDetails} disabled={aiDetailsLoading}
                  style={{ background: aiDetailsLoading ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '7px 12px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: aiDetailsLoading ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                  {aiDetailsLoading ? '✦ Writing...' : '✦ AI Fill'}
                </button>
              </div>
              {aiDetailsLoading && (
                <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: C.accent }}>✦ Writing your title, description and tags...</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={lbl}>Product Title</label>
                  <input value={title} onChange={e => { setTitle(e.target.value); setTitleTouched(true) }} maxLength={100} style={inp} placeholder="e.g. Cosmic Eagle All-Over Print T-Shirt" />
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Include the art style + product type for best discoverability</div>
                </div>
                <div>
                  <label style={lbl}>Description <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={500} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} placeholder="What makes this product special?" />
                </div>
                <div>
                  <label style={lbl}>Style Tags</label>
                  <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. cyberpunk, neon, fantasy, dark art" style={inp} />
                  {tags.trim() && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                      {tags.split(',').map(t => t.trim()).filter(Boolean).map((t, i) => (
                        <span key={i} style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}33`, borderRadius: 20, padding: '2px 8px', fontSize: 10, color: C.accent }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={lbl}>Your Price (USD)</label>
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }}>$</span>
                    <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="5" step="0.01" style={{ ...inp, paddingLeft: 26 }} />
                  </div>
                  {base && (
                    <div style={{ background: C.card, border: `1px solid ${profit && profit.earnings <= 0 ? C.red+'44' : C.border}`, borderRadius: 12, padding: '12px 16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 6 }}>
                        {[
                          ['Production cost', `$${base.toFixed(2)}`, C.muted],
                          ['Platform fees', price ? `$${((parseFloat(price)||0)*0.13+0.30).toFixed(2)}` : '—', C.muted],
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
                          : profit
                          ? `${profit.margin.toFixed(0)}% margin · Suggested: $${suggestPrice(base)}`
                          : `Suggested: $${suggestPrice(base)}`}
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
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, marginBottom: 8 }}>Product Live!</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 6 }}>
                <strong style={{ color: C.text }}>{title}</strong> is now available in {selectedColors.length} {isWallArt ? 'size' : 'color'}{selectedColors.length !== 1 ? 's' : ''} and ready to ship worldwide.
              </p>
              {mockupStatus === 'generating' && <p style={{ fontSize: 12, color: C.gold, marginBottom: 16 }}>✦ Product image is generating — it'll appear shortly.</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
                <button onClick={() => { onSuccess?.(); navigate('/marketplace') }} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '11px 22px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>View in Marketplace</button>
                <button onClick={() => { onSuccess?.(); navigate('/profile') }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 22px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>My Profile</button>
                <button onClick={onClose} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 22px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Close</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step > 0 && step < 4 && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
            {step > 1 && <button onClick={() => setStep(s => s - 1)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 18px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>← Back</button>}
            <div style={{ flex: 1 }} />
            {step === 1 && <button onClick={() => selected && !variantLoading && setStep(2)} disabled={!selected || variantLoading} style={{ background: !selected || variantLoading ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: !selected || variantLoading ? 'not-allowed' : 'pointer' }}>{variantLoading ? 'Loading...' : selected ? 'Choose Colors →' : 'Select a product first'}</button>}
            {step === 2 && <button onClick={() => selectedColors.length > 0 && setStep(3)} disabled={selectedColors.length === 0} style={{ background: selectedColors.length === 0 ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: selectedColors.length === 0 ? 'not-allowed' : 'pointer' }}>{selectedColors.length === 0 ? 'Select at least one color' : 'Add Details →'}</button>}
            {step === 3 && <button onClick={handleCreate} disabled={creating} style={{ background: creating ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer' }}>{creating ? 'Creating...' : 'Publish Product ✦'}</button>}
          </div>
        )}
      </div>
    </div>
  )
}
