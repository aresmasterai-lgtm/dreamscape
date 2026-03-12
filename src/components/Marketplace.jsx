import { useState, useEffect } from 'react'

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
      {success && <div style={{ background: `${C.teal}18`, border: `1px solid ${C.teal}55`, borderRadius: 10, padding: '12px 18px', marginBottom: 24, fontSize: 14, color: C.teal }}>✅ Product created successfully in your Printful store!</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        {products.map(product => (
          <div key={product.id} onClick={() => user ? setSelected(product) : onSignIn()}
            style={{ background: C.card, border: `1px solid ${selected?.id === product.id ? C.accent : C.border}`, borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '88'}
            onMouseLeave={e => e.currentTarget.style.borderColor = selected?.id === product.id ? C.accent : C.border}>
            <div style={{ height: 140, background: `linear-gradient(135deg, ${C.accent}22, ${C.teal}22)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
              {product.image ? <img src={product.image} alt={product.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getEmoji(product.type)}
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

// ── Shop Tab (with Buy buttons) ───────────────────────────────
function ShopView({ user, onSignIn }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [buyingId, setBuyingId] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedVariant, setSelectedVariant] = useState(null)

  useEffect(() => {
    fetch('/api/printful?action=store')
      .then(r => r.json())
      .then(data => { setProducts(data.products || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const openProduct = (product) => {
    setSelectedProduct(product)
    setSelectedVariant(product.variants?.[0] || null)
  }

  const handleBuy = async () => {
    if (!user) return onSignIn()
    if (!selectedProduct) return
    setBuyingId(selectedProduct.id)

    // Use first variant price, or a sensible default
    const price = selectedVariant?.retail_price
      ? parseFloat(selectedVariant.retail_price)
      : 29.99

    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: selectedProduct.name,
          variantName: selectedVariant?.name || '',
          price,
          imageUrl: selectedProduct.thumbnail_url || '',
          printfulProductId: selectedProduct.id,
          printfulVariantId: selectedVariant?.id || '',
          quantity: 1,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Checkout failed: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Connection error. Please try again.')
    } finally {
      setBuyingId(null)
    }
  }

  if (loading) return <Spinner />

  if (products.length === 0) return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
      <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6 }}>
        No products listed yet. Browse the <strong style={{ color: C.accent }}>Create Products</strong> tab and create your first product!
      </p>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {products.map(product => (
          <div key={product.id}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', transition: 'all 0.2s', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent + '55'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)' }}
            onClick={() => openProduct(product)}>
            <div style={{ height: 200, background: `linear-gradient(135deg, ${C.accent}22, ${C.teal}22)`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              {product.thumbnail_url
                ? <img src={product.thumbnail_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 52 }}>🎨</span>
              }
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{product.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <div style={{ fontSize: 13, color: C.teal, fontWeight: 700 }}>
                  {product.variants?.[0]?.retail_price ? `$${parseFloat(product.variants[0].retail_price).toFixed(2)}` : 'View pricing'}
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>{product.variants_count || product.variants?.length || 0} variants</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Product Detail / Buy Modal */}
      {selectedProduct && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,11,20,0.92)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => e.target === e.currentTarget && setSelectedProduct(null)}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '0', maxWidth: 520, width: '100%', overflow: 'hidden' }}>
            <div style={{ height: 220, background: `linear-gradient(135deg, ${C.accent}22, ${C.teal}22)`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {selectedProduct.thumbnail_url
                ? <img src={selectedProduct.thumbnail_url} alt={selectedProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 64 }}>🎨</span>
              }
              <button onClick={() => setSelectedProduct(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(8,11,20,0.7)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: C.text, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: '24px 28px' }}>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 8 }}>{selectedProduct.name}</h3>

              {selectedProduct.variants?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Select Variant</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedProduct.variants.slice(0, 8).map(v => (
                      <button key={v.id} onClick={() => setSelectedVariant(v)}
                        style={{ background: selectedVariant?.id === v.id ? `${C.accent}30` : C.bg, border: `1px solid ${selectedVariant?.id === v.id ? C.accent : C.border}`, borderRadius: 8, padding: '6px 12px', color: selectedVariant?.id === v.id ? C.accent : C.muted, fontSize: 12, cursor: 'pointer' }}>
                        {v.name?.split(' / ').slice(-2).join(' / ') || v.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.teal, fontFamily: 'Playfair Display, serif' }}>
                  {selectedVariant?.retail_price ? `$${parseFloat(selectedVariant.retail_price).toFixed(2)}` : '$29.99'}
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>Free worldwide shipping</div>
              </div>

              <button onClick={handleBuy} disabled={buyingId === selectedProduct.id}
                style={{ width: '100%', background: buyingId === selectedProduct.id ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 12, padding: '14px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: buyingId === selectedProduct.id ? 'not-allowed' : 'pointer' }}>
                {buyingId === selectedProduct.id ? '⏳ Redirecting to checkout...' : '🛒 Buy Now'}
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
