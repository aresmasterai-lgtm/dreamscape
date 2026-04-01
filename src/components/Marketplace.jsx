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

// ── Star Rating Widget ────────────────────────────────────────
function StarRating({ value, onChange, size = 18, readonly = false }) {
  const [hover, setHover] = useState(0)
  const display = hover || value || 0
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n}
          onClick={() => !readonly && onChange?.(n)}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(0)}
          style={{ fontSize: size, cursor: readonly ? 'default' : 'pointer', color: n <= display ? '#F5C842' : C.border, lineHeight: 1, transition: 'color 0.1s', userSelect: 'none' }}>
          ★
        </span>
      ))}
    </div>
  )
}

// ── Product Reviews (compact modal version) ───────────────────
function ProductReviews({ productId, user, compact = false }) {
  const [reviews, setReviews]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [myReview, setMyReview]     = useState(null)
  const [rating, setRating]         = useState(0)
  const [body, setBody]             = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing]       = useState(false)
  const [error, setError]           = useState('')
  const [showAll, setShowAll]       = useState(false)

  useEffect(() => { loadReviews() }, [productId])

  const loadReviews = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('product_reviews')
      .select('*, profiles!user_id(username, avatar_url, display_name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
    setReviews(data || [])
    if (user && data) {
      const mine = data.find(r => r.user_id === user.id)
      if (mine) { setMyReview(mine); setRating(mine.rating); setBody(mine.body || '') }
    }
    setLoading(false)
  }

  const handleSubmit = async () => {
    if (!rating) { setError('Please select a star rating.'); return }
    setError(''); setSubmitting(true)
    try {
      if (myReview) {
        const { error: e } = await supabase.from('product_reviews')
          .update({ rating, body: body.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', myReview.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('product_reviews')
          .insert({ product_id: productId, user_id: user.id, rating, body: body.trim() || null })
        if (e) throw e
      }
      setEditing(false)
      await loadReviews()
    } catch (e) { setError(e.message || 'Failed to submit.') }
    setSubmitting(false)
  }

  const handleDelete = async () => {
    if (!myReview || !window.confirm('Delete your review?')) return
    await supabase.from('product_reviews').delete().eq('id', myReview.id)
    setMyReview(null); setRating(0); setBody('')
    await loadReviews()
  }

  const others = reviews.filter(r => r.user_id !== user?.id)
  const shown  = showAll ? others : others.slice(0, compact ? 3 : 5)

  if (loading) return <div style={{ fontSize: 12, color: C.muted, padding: '8px 0' }}>Loading reviews...</div>

  return (
    <div>
      {/* Write / edit */}
      {user && (!myReview || editing) && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
          <StarRating value={rating} onChange={setRating} size={22} />
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Share your thoughts... (optional)" maxLength={1000} rows={2}
            style={{ width: '100%', marginTop: 8, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          {error && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={handleSubmit} disabled={submitting || !rating}
              style={{ background: rating ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : C.border, border: 'none', borderRadius: 7, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: rating ? 'pointer' : 'not-allowed' }}>
              {submitting ? '...' : myReview ? 'Update' : 'Submit'}
            </button>
            {myReview && <button onClick={() => { setEditing(false); setRating(myReview.rating); setBody(myReview.body || '') }}
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, padding: '6px 12px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Cancel</button>}
          </div>
        </div>
      )}

      {/* Own review (non-editing) */}
      {myReview && !editing && (
        <div style={{ background: `${C.accent}0A`, border: `1px solid ${C.accent}33`, borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>Your review</span>
              <StarRating value={myReview.rating} readonly size={11} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 11, cursor: 'pointer', padding: 0 }}>Edit</button>
              <button onClick={handleDelete} style={{ background: 'none', border: 'none', color: C.red, fontSize: 11, cursor: 'pointer', padding: 0 }}>Delete</button>
            </div>
          </div>
          {myReview.body && <p style={{ fontSize: 12, color: C.text, lineHeight: 1.5, margin: 0 }}>{myReview.body}</p>}
        </div>
      )}

      {/* Others' reviews */}
      {shown.map(r => (
        <div key={r.id} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, overflow: 'hidden', flexShrink: 0 }}>
              {r.profiles?.avatar_url
                ? <img src={r.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>{(r.profiles?.username||'?')[0].toUpperCase()}</div>
              }
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{r.profiles?.display_name || '@'+r.profiles?.username}</span>
            <StarRating value={r.rating} readonly size={11} />
            <span style={{ fontSize: 10, color: C.muted, marginLeft: 'auto' }}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
          {r.body && <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, margin: 0 }}>{r.body}</p>}
        </div>
      ))}

      {others.length > (compact ? 3 : 5) && (
        <button onClick={() => setShowAll(v => !v)}
          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 12px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>
          {showAll ? 'Show less' : `Show all ${others.length} reviews`}
        </button>
      )}

      {reviews.length === 0 && (
        <div style={{ fontSize: 12, color: C.muted }}>
          {user ? 'No reviews yet — be the first!' : 'No reviews yet.'}
        </div>
      )}
    </div>
  )
}

// Image URL helper — only transform Supabase storage URLs through Netlify CDN
// External CDN URLs (Printful, CloudFront, etc.) are served directly
function imgUrl(src, w = 800, q = 80) {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return src
  // Only proxy Supabase storage through Netlify Image CDN
  if (src.includes('supabase.co')) {
    return `/.netlify/images?url=${encodeURIComponent(src)}&w=${w}&q=${q}&fm=webp`
  }
  // Printful/external CDN — serve directly, they handle their own CDN
  return src
}

// Blur-up lazy image with fallback retry on error
function LazyImage({ src, alt, style, onClick, width = 800, quality = 80, priority = false, fallbackSrc = null }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [retried, setRetried] = useState(false)
  const [useFallback, setUseFallback] = useState(false)

  const handleError = () => {
    // Step 1: CDN failed — try raw URL directly
    if (!retried && src && src !== imgUrl(src, width, quality)) {
      setRetried(true)
      return
    }
    // Step 2: Raw URL failed — try artwork fallback if available
    if (!useFallback && fallbackSrc) {
      setUseFallback(true)
      setRetried(false)
      setLoaded(false)
      return
    }
    // Step 3: Everything failed — show unavailable state
    setError(true)
    setLoaded(true)
  }

  const activeSrc = useFallback ? fallbackSrc : src
  const resolvedSrc = retried || useFallback ? activeSrc : imgUrl(activeSrc, width, quality)

  return (
    <div style={{ position: 'relative', overflow: 'hidden', ...style }} onClick={onClick}>
      {!loaded && !error && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(110deg, ${C.card} 30%, ${C.border} 50%, ${C.card} 70%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />}
      {activeSrc && !error && <img
        src={resolvedSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchpriority={priority ? 'high' : 'auto'}
        onLoad={() => { setLoaded(true); setError(false) }}
        onError={handleError}
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s', display: 'block' }}
      />}
      {(error || !activeSrc) && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `${C.accent}12`, gap: 8 }}>
          <span style={{ fontSize: 52 }}>{getEmoji('product')}</span>
        </div>
      )}
    </div>
  )
}

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

const LOADING_QUOTES = [
  'Art is loading into existence...',
  'Gathering creative energy...',
  'Something beautiful is coming...',
  'Every masterpiece takes a moment...',
  'Painting the digital canvas...',
  'The muse is working...',
]

function Spinner({ label, cards = 0 }) {
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * LOADING_QUOTES.length))

  useEffect(() => {
    if (!cards) return
    const t = setInterval(() => setQuoteIdx(i => (i + 1) % LOADING_QUOTES.length), 2200)
    return () => clearInterval(t)
  }, [cards])

  if (cards > 0) return (
    <div>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
      <div style={{ textAlign: 'center', marginBottom: 20, minHeight: 28 }}>
        <span style={{ fontSize: 13, color: C.accent, fontStyle: 'italic' }}>
          ✦ {LOADING_QUOTES[quoteIdx]}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} style={{ borderRadius: 16, overflow: 'hidden', background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ height: 200, background: `linear-gradient(110deg, ${C.card} 30%, ${C.border} 50%, ${C.card} 70%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 14, borderRadius: 6, width: '65%', background: `linear-gradient(110deg, ${C.card} 30%, ${C.border} 50%, ${C.card} 70%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.2}s` }} />
              <div style={{ height: 10, borderRadius: 6, width: '40%', background: `linear-gradient(110deg, ${C.card} 30%, ${C.border} 50%, ${C.card} 70%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.3}s` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 0' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
      </div>
      {label && <p style={{ fontSize: 12, color: C.muted, margin: 0, fontStyle: 'italic' }}>{label}</p>}
    </div>
  )
}

// ── Image Lightbox ────────────────────────────────────────────
function ImageLightbox({ image, onClose }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

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
      style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(8,11,20,0.97)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'center', padding: isMobile ? 0 : 20, cursor: 'zoom-out', overflowY: 'auto' }}>
      <style>{`@keyframes lbIn { from { opacity:0; transform:scale(0.94) } to { opacity:1; transform:scale(1) } }`}</style>

      {/* Close — fixed, always reachable */}
      <button onClick={onClose}
        style={{ position: 'fixed', top: isMobile ? 16 : 20, right: isMobile ? 16 : 20, zIndex: 910, background: 'rgba(8,11,20,0.9)', border: `1px solid ${C.border}`, borderRadius: '50%', width: isMobile ? 44 : 36, height: isMobile ? 44 : 36, color: C.text, cursor: 'pointer', fontSize: isMobile ? 20 : 16, display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent', boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
        ✕
      </button>

      <div style={{ position: 'relative', maxWidth: 860, width: '100%', animation: 'lbIn 0.18s ease', padding: isMobile ? '60px 0 0' : 0 }} onClick={e => e.stopPropagation()}>
        <img src={image.src} alt={image.alt}
          style={{ width: '100%', borderRadius: isMobile ? 0 : 16, boxShadow: isMobile ? 'none' : `0 0 80px ${C.accent}33`, display: 'block', maxHeight: isMobile ? '70vh' : '78vh', objectFit: 'contain', background: C.panel }} />
        {(image.title || image.caption) && (
          <div style={{ marginTop: 14, textAlign: 'center', padding: isMobile ? '0 20px 40px' : 0 }}>
            {image.title && <div style={{ fontSize: isMobile ? 17 : 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>{image.title}</div>}
            {image.caption && <div style={{ fontSize: 13, color: C.muted }}>{image.caption}</div>}
            {isMobile && <div style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>Tap anywhere to close</div>}
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
  const [editTarget, setEditTarget] = useState(null)

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

  if (loading) return <Spinner cards={8} />
  if (products.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
      <p style={{ color: C.muted, fontSize: 14 }}>Could not load catalog. Check your Printful API key in Netlify env vars.</p>
    </div>
  )

  return (
    <div>
      {lightbox && <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />}
      {editTarget && user && (
        <EditProductModal
          product={editTarget}
          user={user}
          onSave={handleEditSave}
          onClose={() => setEditTarget(null)}
        />
      )}
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
            {loadingMore ? 'Loading more...' : 'Load More Products'}
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
  const [editTarget, setEditTarget] = useState(null)
  const [wishlist, setWishlist] = useState(new Set())
  const [wishlistLoading, setWishlistLoading] = useState(new Set())
  const navigate = useNavigate()

  const STYLE_TAGS = ['All', 'Abstract', 'Portrait', 'Fantasy', 'Nature', 'Anime', 'Surreal', 'Dark', 'Minimalist', 'Retro', 'Sci-Fi', 'Street Art', 'Floral', 'Geometric', 'Cyberpunk', 'Watercolor', 'Vintage', 'Cosmic']
  const PRODUCT_TYPES = ['All', 'T-Shirt', 'Hoodie', 'Poster', 'Canvas', 'Framed', 'Wall Art', 'Mug', 'Phone Case', 'Tote Bag', 'Pillow', 'Blanket', 'Hat', 'Sticker', 'Other']

  useEffect(() => { loadProducts() }, [])
  useEffect(() => { if (user) loadWishlist() }, [user])

  const loadWishlist = async () => {
    const { data } = await supabase.from('wishlist').select('product_id').eq('user_id', user.id)
    if (data) setWishlist(new Set(data.map(w => w.product_id)))
  }

  const toggleWishlist = async (productId) => {
    if (!user) return onSignIn()
    setWishlistLoading(prev => new Set([...prev, productId]))
    if (wishlist.has(productId)) {
      await supabase.from('wishlist').delete().eq('user_id', user.id).eq('product_id', productId)
      setWishlist(prev => { const n = new Set(prev); n.delete(productId); return n })
    } else {
      await supabase.from('wishlist').insert({ user_id: user.id, product_id: productId })
      setWishlist(prev => new Set([...prev, productId]))
    }
    setWishlistLoading(prev => { const n = new Set(prev); n.delete(productId); return n })
  }

  const loadProducts = async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select('*, profiles!user_id(id, username), artwork:artwork_id(image_url)')
        .or('broken_image.is.null,broken_image.eq.false').or('is_hidden.is.null,is_hidden.eq.false').order('created_at', { ascending: false })
        .limit(100)
      // Flatten artwork image URL for easy access
      const products_with_art = (data || []).map(p => ({
        ...p,
        artwork_image_url: p.artwork?.image_url || null,
      }))
      setProducts(products_with_art)
    } catch {}
    setLoading(false)
  }

  const handleEditSave = (updated) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
    setEditTarget(null)
  }

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.title}"? This cannot be undone.`)) return
    const { error } = await supabase.from('products').delete().eq('id', product.id).eq('user_id', user.id)
    if (!error) setProducts(prev => prev.filter(p => p.id !== product.id))
  }

  const filtered = products.filter(p => {
    const matchStyle = styleFilter === 'All' || p.tags?.includes(styleFilter)
    const matchType = typeFilter === 'All' || (() => {
      const pt = (p.product_type || '').toLowerCase()
      const t  = typeFilter.toLowerCase()
      if (t === 'canvas')   return pt.includes('canvas') && !pt.includes('tote')
      if (t === 'wall art') return pt.includes('wall') || pt.includes('metal print') || pt.includes('acrylic') || pt.includes('wood print')
      if (t === 'framed')   return pt.includes('framed')
      if (t === 'other')    return !['t-shirt','shirt','tee','hoodie','mug','poster','canvas','framed','phone','tote','pillow','blanket','hat','sticker','wall'].some(k => pt.includes(k))
      return pt.includes(t)
    })()
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

  if (loading) return <Spinner cards={8} />

  return (
    <div>
      {lightbox && <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />}
      {editTarget && user && (
        <EditProductModal
          product={editTarget}
          user={user}
          onSave={handleEditSave}
          onClose={() => setEditTarget(null)}
        />
      )}

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
          {filtered.map((product, idx) => (
            <ProductCard
              key={product.id}
              product={product}
              user={user}
              onView={() => setSelectedProduct(product)}
              onLightbox={() => product.mockup_url && setLightbox({ src: product.mockup_url, alt: productAltTag(product), title: product.title, caption: `by @${product.profiles?.username || 'artist'}` })}
              onBuy={() => handleBuy(product)}
              buyingId={buyingId}
              isWishlisted={wishlist.has(product.id)}
              onWishlist={() => toggleWishlist(product.id)}
              wishlistLoading={wishlistLoading.has(product.id)}
              onEdit={setEditTarget}
              onDelete={handleDelete}
              priority={idx < 8}
            />
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
                ? <LazyImage src={selectedProduct.mockup_url} alt={productAltTag(selectedProduct)} width={600} priority style={{ width: '100%', height: '100%' }} />
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

              {/* Reviews inline */}
              <div style={{ marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                  ★ Reviews
                  {selectedProduct.review_count > 0 && (
                    <span style={{ fontSize: 11, color: '#F5C842', fontWeight: 400, marginLeft: 8 }}>
                      {parseFloat(selectedProduct.avg_rating || 0).toFixed(1)} · {selectedProduct.review_count} review{selectedProduct.review_count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <ProductReviews productId={selectedProduct.id} user={user} compact={true} />
              </div>
            </div>
          </div>
        </div>
      )}

      {editTarget && user && (
        <EditProductModal
          product={editTarget}
          user={user}
          onSave={(updated) => {
            setProducts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
            setEditTarget(null)
          }}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}

// ── Main Export ───────────────────────────────────────────────

// ── Edit Product Modal ────────────────────────────────────────
function EditProductModal({ product, user, onSave, onClose }) {
  const [title, setTitle]       = useState(product.title || '')
  const [description, setDesc]  = useState(product.description || '')
  const [tags, setTags]         = useState((product.tags || []).join(', '))
  const [price, setPrice]       = useState(String(product.price || ''))
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return }
    if (!price || isNaN(parseFloat(price))) { setError('Enter a valid price.'); return }
    setError(''); setSaving(true)
    try {
      const updates = {
        title: title.trim(),
        description: description.trim() || null,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        price: parseFloat(price),
        updated_at: new Date().toISOString(),
      }
      const { error: dbErr } = await supabase.from('products').update(updates).eq('id', product.id).eq('user_id', user.id)
      if (dbErr) throw dbErr
      // Sync price to Printful (fire-and-forget)
      if (product.printful_variant_ids?.length) {
        getAuthHeader().then(h => fetch('/api/printful?action=updateVariantPrice', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({ variantIds: product.printful_variant_ids, retailPrice: parseFloat(price).toFixed(2) }),
        }).catch(() => {}))
      }
      onSave({ ...product, ...updates })
      onClose()
    } catch (e) { setError(e.message || 'Failed to save.') }
    setSaving(false)
  }

  const TAGS = ['Abstract', 'Portrait', 'Fantasy', 'Nature', 'Anime', 'Surreal', 'Dark', 'Minimalist', 'Retro', 'Sci-Fi', 'Vintage', 'Geometric']
  const currentTags = tags.split(',').map(t => t.trim()).filter(Boolean)
  const toggleTag = (tag) => {
    const updated = currentTags.includes(tag) ? currentTags.filter(t => t !== tag) : [...currentTags, tag]
    setTags(updated.join(', '))
  }

  const inp = { width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(8,11,20,0.96)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 0 60px rgba(124,92,252,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: C.card, zIndex: 1 }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text, marginBottom: 2 }}>Edit Product</div>
            <div style={{ fontSize: 12, color: C.muted }}>Update title, description, tags and price</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {product.mockup_url && (
          <div style={{ height: 130, overflow: 'hidden', position: 'relative' }}>
            <img src={product.mockup_url} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(19,24,38,0.9) 0%, transparent 60%)' }} />
            <div style={{ position: 'absolute', bottom: 10, left: 14, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{product.product_type}</div>
          </div>
        )}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Title</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="Product title..." maxLength={100} style={inp} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Description</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} placeholder="Describe this product..." rows={3} maxLength={1000} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Price (USD)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 14 }}>$</span>
              <input value={price} onChange={e => setPrice(e.target.value)} placeholder="29.99" type="number" min="0" step="0.01" style={{ ...inp, paddingLeft: 28 }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Style Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {TAGS.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  style={{ background: currentTags.includes(tag) ? `${C.accent}22` : 'none', border: `1px solid ${currentTags.includes(tag) ? C.accent + '66' : C.border}`, borderRadius: 20, padding: '4px 12px', color: currentTags.includes(tag) ? C.accent : C.muted, fontSize: 11, fontWeight: currentTags.includes(tag) ? 700 : 400, cursor: 'pointer' }}>
                  {tag}
                </button>
              ))}
            </div>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Or type custom tags, comma-separated" style={{ ...inp, fontSize: 12 }} />
          </div>
          {error && <div style={{ background: 'rgba(255,77,77,0.12)', border: '1px solid rgba(255,77,77,0.4)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: '#FF4D4D' }}>{error}</div>}
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, position: 'sticky', bottom: 0, background: C.card }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: saving ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : '✦ Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Product Card with kebab menu ─────────────────────────────
function ProductCard({ product, user, onView, onLightbox, onBuy, buyingId, onEdit, onDelete, priority = false, isWishlisted = false, onWishlist, wishlistLoading = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const handleShare = () => {
    const url = `https://trydreamscape.com/product/${product.id}`
    if (navigator.share) {
      navigator.share({ title: product.title, text: `Check out this AI art merch!`, url })
    } else {
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    setMenuOpen(false)
  }

  return (
    <div className='ds-card' style={{ overflow: 'visible', cursor: 'pointer', position: 'relative' }}>
      {/* Image area */}
      <div style={{ height: 200, background: `linear-gradient(135deg, ${C.accent}22, ${C.teal}22)`, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '14px 14px 0 0' }}
        onClick={onLightbox}>
        {product.mockup_url || product.artwork_image_url
          ? <LazyImage src={product.mockup_url || product.artwork_image_url} alt={productAltTag(product)} width={400} priority={priority} fallbackSrc={product.artwork_image_url || null} style={{ width: '100%', height: '100%' }}
            onBroken={(id) => setProducts && setProducts(prev => prev.filter(p => p.id !== id))}
            resourceId={product.id}
            resourceType="product" />
          : <span style={{ fontSize: 52 }}>{getEmoji(product.product_type)}</span>}
      </div>

      {/* ⋯ Kebab button — outside image div to escape overflow:hidden */}
      <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 60 }} ref={menuRef} onClick={e => e.stopPropagation()}>

      {/* ♥ Wishlist button */}
      {onWishlist && (
        <button onClick={e => { e.stopPropagation(); onWishlist() }} disabled={wishlistLoading}
          title={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          style={{ position: 'absolute', top: 6, left: 6, zIndex: 60, background: isWishlisted ? '#FF6B9D' : 'rgba(8,11,20,0.82)', border: `1px solid ${isWishlisted ? '#FF6B9D' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, width: 30, height: 30, color: isWishlisted ? '#fff' : '#fff', cursor: wishlistLoading ? 'not-allowed' : 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
          {wishlistLoading ? '·' : isWishlisted ? '♥' : '♡'}
        </button>
      )}
        <button onClick={() => setMenuOpen(o => !o)}
          style={{ background: 'rgba(8,11,20,0.82)', border: `1px solid ${menuOpen ? C.accent + '66' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, width: 30, height: 30, color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
          ⋯
        </button>
        {menuOpen && (
          <div style={{ position: 'absolute', top: 36, right: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, minWidth: 180, zIndex: 200, boxShadow: `0 8px 32px rgba(8,11,20,0.9), 0 0 0 1px ${C.accent}22`, overflow: 'hidden' }}>
            {[
              ...(user && product.user_id === user.id
                ? [
                    { icon: '✏️', label: 'Edit Details', action: () => onEdit(product), color: C.text },
                    { icon: '🗑', label: 'Delete', action: () => onDelete && onDelete(product), color: C.red },
                  ]
                : []),
              { icon: '🔍', label: 'View Details',  action: onView,    color: C.muted },
              { icon: '🖼',  label: 'Full Image',    action: onLightbox, color: C.muted },
              { icon: '🔗',  label: copied ? '✓ Copied!' : 'Share Link', action: handleShare, color: C.teal },
              { icon: '↗',  label: 'Product Page',  action: () => { setMenuOpen(false); navigate(`/product/${product.id}`) }, color: C.muted },
              { icon: '🛍',  label: `Buy — $${parseFloat(product.price || 29.99).toFixed(2)}`, action: onBuy, color: C.teal },
            ].map((item, idx, arr) => (
              <button key={item.label} onClick={() => { item.action() }}
                style={{ width: '100%', background: 'none', border: 'none', borderBottom: idx < arr.length - 1 ? `1px solid ${C.border}` : 'none', padding: '10px 14px', color: item.color, fontSize: 12, fontWeight: 600, cursor: buyingId === product.id ? 'not-allowed' : 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Card footer — click to product detail modal */}
      <div style={{ padding: '12px 14px' }} onClick={onView}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.title}</div>
        {product.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
            {product.tags.slice(0, 2).map(tag => (
              <span key={tag} style={{ background: `${C.accent}18`, borderRadius: 10, padding: '2px 8px', fontSize: 10, color: C.accent }}>{tag}</span>
            ))}
          </div>
        )}
        {product.review_count > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ color: '#F5C842', fontSize: 11 }}>{'★'.repeat(Math.round(product.avg_rating || 0))}</span>
            <span style={{ fontSize: 11, color: C.muted }}>{parseFloat(product.avg_rating || 0).toFixed(1)} ({product.review_count})</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, color: C.teal, fontWeight: 700 }}>${parseFloat(product.price || 29.99).toFixed(2)}</div>
          <div style={{ fontSize: 11, color: C.muted }}>@{product.profiles?.username || 'artist'}</div>
        </div>
      </div>
    </div>
  )
}

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
