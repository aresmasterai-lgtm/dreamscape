import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
}

const EMOJI_MAP = {
  'T-SHIRT': '👕', 'SHIRT': '👕',
  'HOODIE': '🧥', 'SWEATSHIRT': '🧥',
  'POSTER': '🖼️', 'PRINT': '🖼️',
  'MUG': '☕', 'CUP': '☕',
  'PHONE': '📱', 'CASE': '📱',
  'TOTE': '👜', 'BAG': '👜',
  'HAT': '🧢', 'CAP': '🧢',
}

function getEmoji(type = '') {
  const upper = type.toUpperCase()
  for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
    if (upper.includes(key)) return emoji
  }
  return '🎨'
}

function productAltTag(product) {
  const title = product.title || 'AI art product'
  const type = product.product_type ? ` ${product.product_type}` : ''
  const style = product.tags?.length ? ` — ${product.tags.slice(0,3).join(', ')}` : ''
  const by = product.profiles?.username ? ` by @${product.profiles.username}` : ''
  return `${title}${type}${style}${by} on Dreamscape`
}

function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
    </div>
  )
}

// ── Image Lightbox ────────────────────────────────────────────
function ImageLightbox({ image, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(8,11,20,0.97)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
      <style>{`@keyframes lbIn { from { opacity:0; transform:scale(0.94) } to { opacity:1; transform:scale(1) } }`}</style>
      <div style={{ position: 'relative', maxWidth: 860, width: '100%', animation: 'lbIn 0.18s ease' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          style={{ position: 'absolute', top: -14, right: -14, zIndex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: '50%', width: 36, height: 36, color: C.text, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ✕
        </button>
        <img src={image.src} alt={image.alt}
          style={{ width: '100%', borderRadius: 16, boxShadow: `0 0 80px ${C.accent}33`, display: 'block', maxHeight: '78vh', objectFit: 'contain', background: C.panel }} />
        {(image.title || image.caption) && (
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            {image.title && <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>{image.title}</div>}
            {image.caption && <div style={{ fontSize: 12, color: C.muted }}>{image.caption}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Catalog Tab ───────────────────────────────────────────────
function CatalogView({ user, onSignIn }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', imageUrl: '' })
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => { loadProducts(0, true) }, [])

  const loadProducts = async (offsetVal, fresh = false) => {
    fresh ? setLoading(true) : setLoadingMore(true)
    try {
      const res = await fetch(`/api/printful?action=catalog&offset=${offsetVal}`)
      const data = await res.json()
      const newProducts = data.products || []
      setProducts(prev => fresh ? newProducts : [...prev, ...newProducts])
      const paging = data.paging || {}
      setHasMore((offsetVal + newProducts.length) < (paging.total || 0))
      setOffset(offsetVal + newProducts.length)
    } catch (e) {}
    fresh ? setLoading(false) : setLoadingMore(false)
  }

  const handleCreate = async () => {
    if (!form.title.trim()) return setError('Product title is required.')
    if (!form.imageUrl.trim()) return setError('Image URL is required.')
    setError(''); setCreating(true)
    const variants = selected.variants?.slice(0, 3).map(v => v.id) || []
    const res = await fetch('/api/printful?action=create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: form.title, description: form.description, variantIds: variants, imageUrl: form.imageUrl }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      setSuccess(true); setSelected(null); setForm({ title: '', description: '', imageUrl: '' })
      setTimeout(() => setSuccess(false), 4000)
    } else {
      setError(data.error?.message || data.error || 'Something went wrong.')
    }
  }

  if (loading) return <Spinner />
  if (products.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
      <p style={{ color: C.muted, fontSize: 14 }}>Could not load catalog. Check your Printful API key in Netlify env vars.</p>
    </div>
  )

  return (
    <div>
      {lightbox && <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />}
      {success && <div style={{ background: `${C.teal}18`, border: `1px solid ${C.teal}55`, borderRadius: 10, padding: '12px 18px', marginBottom: 24, fontSize: 14, color: C.teal }}>✅ Product created successfully in your Printful store!</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        {products.map(product => (
          <div key={product.id} onClick={() => user ? setSelected(product) : onSignIn()}
            className='ds-card' style={{ overflow: 'hidden', cursor: 'pointer', borderRadius: 14 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '88'}
            onMouseLeave={e => e.currentTarget.style.borderColor = selected?.id === product.id ? C.accent : C.border}>
            <div style={{ height: 140, background: `linear-gradient(135deg, ${C.accent}22, ${C.teal}22)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, position: 'relative', overflow: 'hidden' }}>
              {product.image
                ? <img
                    src={product.image}
                    alt={`${product.model} ${product.type} — Printful product available on Dreamscape`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onClick={e => { e.stopPropagation(); setLightbox({ src: product.image, alt: `${product.model} ${product.type}`, title: product.model, caption: product.type }) }}
                  />
                : getEmoji(product.type)}
            </div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.model}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{product.type}</div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={() => loadProducts(offset)} disabled={loadingMore}
            style={{ background: loadingMore ? C.border : `${C.accent}20`, border: `1px solid ${loadingMore ? C.border : C.accent + '55'}`, borderRadius: 10, padding: '10px 28px', color: loadingMore ? C.muted : C.accent, fontSize: 13, fontWeight: 600, cursor: loadingMore ? 'not-allowed' : 'pointer' }}>
            {loadingMore ? 'Loading...' : 'Load More Products'}
          </button>
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,11,20,0.92)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '32px 36px', maxWidth: 500, width: '100%' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 4 }}>Create Product</h3>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>Applying your art to: <strong style={{ color: C.accent }}>{selected.model}</strong></p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Product Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={`e.g. Cosmic Dreams ${selected.model}`}
                style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Description <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe your product..." rows={2}
                style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Artwork Image URL</label>
              <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://... (direct link to your image)"
                style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <p style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Tip: Use a hosted image URL. Min 1500×1500px recommended.</p>
            </div>
            {error && <div style={{ background: '#ff6b6b18', border: '1px solid #ff6b6b44', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ff6b6b' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setSelected(null); setError('') }} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCreate} disabled={creating} style={{ flex: 2, background: creating ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '11px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer' }}>
                {creating ? 'Creating...' : 'Create Product ✦'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shop View ─────────────────────────────────────────────────
function ShopView({ user, onSignIn }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [buyingId, setBuyingId] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [styleFilter, setStyleFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const navigate = useNavigate()

  const STYLE_TAGS = ['All', 'Abstract', 'Portrait', 'Fantasy', 'Nature', 'Anime', 'Surreal', 'Dark', 'Minimalist', 'Retro', 'Sci-Fi', 'Street Art']
  const PRODUCT_TYPES = ['All', 'T-Shirt', 'Hoodie', 'Mug', 'Poster', 'Phone Case', 'Tote Bag', 'Pillow', 'Other']

  useEffect(() => { loadProducts() }, [])

  const loadProducts = async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select('*, profiles!user_id(id, username)')
        .order('created_at', { ascending: false })
        .limit(100)
      setProducts(data || [])
    } catch {}
    setLoading(false)
  }

  const filtered = products.filter(p => {
    const matchStyle = styleFilter === 'All' || p.tags?.includes(styleFilter)
    const matchType = typeFilter === 'All' || (p.product_type || '').toLowerCase().includes(typeFilter.toLowerCase())
    const matchSearch = !search || p.title?.toLowerCase().includes(search.toLowerCase())
    return matchStyle && matchType && matchSearch
  })

  const handleBuy = async (product) => {
    if (!user) return onSignIn()
    setBuyingId(product.id)
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product.title,
          variantName: '',
          price: product.price || 29.99,
          imageUrl: product.mockup_url || '',
          printfulProductId: product.printful_product_id,
          printfulVariantId: product.printful_variant_ids?.[0] || '',
          quantity: 1,
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Checkout error: ' + (data.error || 'Unknown'))
    } catch { alert('Connection error.') }
    setBuyingId(null)
  }

  if (loading) return <Spinner />

  return (
    <div>
      {lightbox && <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />}

      <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 14px', color: C.text, fontSize: 13, outline: 'none', width: 260 }} />
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Style</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STYLE_TAGS.map(tag => (
              <button key={tag} onClick={() => setStyleFilter(tag)}
                style={{ background: styleFilter === tag ? `${C.accent}20` : 'none', border: `1px solid ${styleFilter === tag ? C.accent + '55' : C.border}`, borderRadius: 20, padding: '4px 14px', color: styleFilter === tag ? C.accent : C.muted, fontSize: 12, fontWeight: styleFilter === tag ? 700 : 400, cursor: 'pointer' }}>
                {tag}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Product Type</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRODUCT_TYPES.map(type => (
              <button key={type} onClick={() => setTypeFilter(type)}
                style={{ background: typeFilter === type ? `${C.teal}20` : 'none', border: `1px solid ${typeFilter === type ? C.teal + '55' : C.border}`, borderRadius: 20, padding: '4px 14px', color: typeFilter === type ? C.teal : C.muted, fontSize: 12, fontWeight: typeFilter === type ? 700 : 400, cursor: 'pointer' }}>
                {type}
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.muted }}>{filtered.length} product{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>
            {products.length === 0 ? 'No products listed yet. Be the first to sell!' : 'No products match your filters.'}
          </p>
          {products.length === 0 && (
            <button onClick={() => navigate('/create')} style={{ marginTop: 16, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Start Creating ✦</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {filtered.map(product => (
            <div key={product.id}
              className='ds-card' style={{ overflow: 'hidden', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent + '55'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)' }}>
              {/* Image — click to lightbox, rest of card opens product modal */}
              <div
                style={{ height: 200, background: `linear-gradient(135deg, ${C.accent}22, ${C.teal}22)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: 'zoom-in' }}
                onClick={() => product.mockup_url && setLightbox({ src: product.mockup_url, alt: productAltTag(product), title: product.title, caption: `by @${product.profiles?.username || 'artist'}` })}>
                {product.mockup_url
                  ? <img src={product.mockup_url} alt={productAltTag(product)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 52 }}>🎨</span>}
                {/* Zoom hint */}
                <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(8,11,20,0.75)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: C.muted }}>🔍 View</div>
              </div>
              {/* Card info — click to product modal */}
              <div style={{ padding: '14px 16px' }} onClick={() => setSelectedProduct(product)}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{product.title}</div>
                {product.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {product.tags.slice(0, 2).map(tag => (
                      <span key={tag} style={{ background: `${C.accent}18`, borderRadius: 10, padding: '2px 8px', fontSize: 10, color: C.accent }}>{tag}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 15, color: C.teal, fontWeight: 700 }}>${parseFloat(product.price || 29.99).toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>@{product.profiles?.username || 'artist'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedProduct && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,11,20,0.93)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => e.target === e.currentTarget && setSelectedProduct(null)}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, maxWidth: 500, width: '100%', overflow: 'hidden' }}>
            {/* Product image — click to full lightbox */}
            <div
              style={{ height: 240, background: `linear-gradient(135deg, ${C.accent}22, ${C.teal}22)`, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: selectedProduct.mockup_url ? 'zoom-in' : 'default' }}
              onClick={() => selectedProduct.mockup_url && setLightbox({ src: selectedProduct.mockup_url, alt: productAltTag(selectedProduct), title: selectedProduct.title, caption: `by @${selectedProduct.profiles?.username || 'artist'}` })}>
              {selectedProduct.mockup_url
                ? <img src={selectedProduct.mockup_url} alt={productAltTag(selectedProduct)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 64 }}>🎨</span>}
              {selectedProduct.mockup_url && (
                <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(8,11,20,0.75)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: C.muted }}>🔍 View full image</div>
              )}
              <button onClick={e => { e.stopPropagation(); setSelectedProduct(null) }} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(8,11,20,0.8)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: C.text, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: '24px 28px' }}>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 4 }}>{selectedProduct.title}</h3>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>by @{selectedProduct.profiles?.username || 'artist'} · {selectedProduct.product_type}</div>
              {selectedProduct.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {selectedProduct.tags.map(tag => (
                    <span key={tag} style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '3px 10px', fontSize: 11, color: C.accent }}>{tag}</span>
                  ))}
                </div>
              )}
              {selectedProduct.description && <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>{selectedProduct.description}</p>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: C.teal, fontFamily: 'Playfair Display, serif' }}>${parseFloat(selectedProduct.price || 29.99).toFixed(2)}</div>
                <div style={{ fontSize: 12, color: C.muted }}>Free worldwide shipping</div>
              </div>
              <button onClick={() => handleBuy(selectedProduct)} disabled={buyingId === selectedProduct.id}
                style={{ width: '100%', background: buyingId === selectedProduct.id ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 12, padding: '14px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: buyingId === selectedProduct.id ? 'not-allowed' : 'pointer' }}>
                {buyingId === selectedProduct.id ? '⏳ Redirecting...' : '🛒 Buy Now'}
              </button>
              <p style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 10 }}>Secure checkout powered by Stripe</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Export ───────────────────────────────────────────────
export default function Marketplace({ user, onSignIn }) {
  const [tab, setTab] = useState('shop')

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, marginBottom: 8, color: C.text }}>Marketplace</h1>
        <p style={{ color: C.muted }}>Shop unique AI-designed merchandise, or create and sell your own.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {[['shop', '🛒 Shop'], ['catalog', '🛍️ Create Products']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ background: tab === id ? `${C.accent}20` : 'none', border: `1px solid ${tab === id ? C.accent + '55' : C.border}`, borderRadius: 8, padding: '8px 18px', color: tab === id ? C.accent : C.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>{label}</button>
        ))}
      </div>

      {!user && tab === 'catalog' && (
        <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 14, color: C.text }}>Sign in to create and sell products</span>
          <button onClick={onSignIn} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '8px 18px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sign In</button>
        </div>
      )}

      {tab === 'shop' && <ShopView user={user} onSignIn={onSignIn} />}
      {tab === 'catalog' && <CatalogView user={user} onSignIn={onSignIn} />}
    </div>
  )
}
