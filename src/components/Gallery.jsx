import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CreateProductModal from './CreateProductModal'

async function getAuthHeader() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) return { 'Authorization': `Bearer ${session.access_token}` }
  } catch {}
  return {}
}

// Netlify Image CDN transform
function imgUrl(src, w = 800, q = 80) {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return src
  if (src.includes('supabase.co')) {
    return `/.netlify/images?url=${encodeURIComponent(src)}&w=${w}&q=${q}&fm=webp`
  }
  return src
}

// Blur-up lazy image
function LazyImage({ src, alt, style, onClick, width = 800, quality = 80, priority = false, onBroken = null, resourceId = null, resourceType = null }) {
  const [loaded, setLoaded]     = useState(false)
  const [error, setError]       = useState(false)
  const [reported, setReported] = useState(false)

  const handleError = async () => {
    setError(true); setLoaded(true)
    if (onBroken && resourceId && resourceType && !reported) {
      setReported(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          fetch('/api/report-broken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ resourceId, resourceType }),
          }).catch(() => {})
          onBroken(resourceId)
        }
      } catch {}
    }
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', ...style }} onClick={onClick}>
      {!loaded && !error && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(110deg, ${C.card} 30%, ${C.border} 50%, ${C.card} 70%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />}
      {src && !error && <img src={imgUrl(src, width, quality)} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async"
        onLoad={() => setLoaded(true)} onError={handleError}
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s', display: 'block' }} />}
      {error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `${C.accent}10`, gap: 6 }}>
          <span style={{ fontSize: 20, opacity: 0.35 }}>✦</span>
          <span style={{ fontSize: 10, color: C.muted, opacity: 0.5 }}>Unavailable</span>
        </div>
      )}
    </div>
  )
}


const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494', red: '#FF4D4D',
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
      <div style={{ columns: '2 240px', gap: 16 }}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} style={{ breakInside: 'avoid', marginBottom: 14, borderRadius: 14, overflow: 'hidden', background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ height: [160, 200, 140, 220, 180, 160][i % 6], background: `linear-gradient(110deg, ${C.card} 30%, ${C.border} 50%, ${C.card} 70%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ height: 12, borderRadius: 6, width: '60%', background: `linear-gradient(110deg, ${C.card} 30%, ${C.border} 50%, ${C.card} 70%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.2}s` }} />
              <div style={{ height: 10, borderRadius: 6, width: '35%', background: `linear-gradient(110deg, ${C.card} 30%, ${C.border} 50%, ${C.card} 70%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.3}s` }} />
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

// ── Alt tag generator ─────────────────────────────────────────
function artAltTag(art) {
  const title = art.title || 'AI generated artwork'
  const styles = art.style_tags?.length ? ` in ${art.style_tags.slice(0,3).join(', ')} style` : ''
  const by = art.profiles?.username ? ` by @${art.profiles.username}` : ''
  const promptSnippet = art.prompt ? ` — ${art.prompt.slice(0, 80)}` : ''
  return `${title}${styles}${by} on Dreamscape${promptSnippet}`
}

// ── Image Lightbox ────────────────────────────────────────────
function ImageLightbox({ image, onClose, onSell, onDownload, isOwn = false }) {
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
          style={{ width: '100%', borderRadius: isMobile ? 0 : 16, boxShadow: isMobile ? 'none' : `0 0 80px ${C.accent}33`, display: 'block', maxHeight: isMobile ? '65vh' : '75vh', objectFit: 'contain', background: C.panel }} />

        {(image.title || image.username) && (
          <div style={{ marginTop: 14, textAlign: 'center', padding: isMobile ? '0 20px' : 0 }}>
            {image.title && <div style={{ fontSize: isMobile ? 17 : 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>{image.title}</div>}
            {image.username && <div style={{ fontSize: 13, color: C.accent, marginBottom: 6 }}>@{image.username}</div>}
            {image.prompt && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, maxWidth: 600, margin: '0 auto' }}>{image.prompt.slice(0, 200)}{image.prompt.length > 200 ? '\u2026' : ''}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap', padding: isMobile ? '0 16px 40px' : 0 }}>
          {onSell && (
            <button onClick={onSell}
              style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: isMobile ? '12px 20px' : '10px 22px', color: '#fff', fontSize: isMobile ? 14 : 13, fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              \ud83d\udecd Sell This
            </button>
          )}
          {isOwn && (
            <a href={image.src} download={`${image.title || 'dreamscape-art'}.png`} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: isMobile ? '12px 20px' : '10px 18px', color: C.muted, fontSize: isMobile ? 14 : 13, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              \u2193 Download
            </a>
          )}
          {!onSell && !isOwn && isMobile && (
            <div style={{ fontSize: 12, color: C.muted, padding: '8px 0' }}>Tap anywhere to close</div>
          )}
        </div>
      </div>
    </div>
  )
}


// ── Art Card ──────────────────────────────────────────────────
function ArtCard({ art, isOwn, onLightbox, onSell, onUseAgain, onDelete, onEdit }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const menuItems = isOwn
    ? [
        { icon: '✏️', label: 'Edit Details', action: () => onEdit(art), color: C.text },
        { icon: '🔍', label: 'View Full',    action: () => onLightbox(art), color: C.muted },
        { icon: '🛍', label: 'Sell This',    action: () => onSell(art), color: C.accent },
        { icon: '↻',  label: 'Use Again',    action: () => onUseAgain(art), color: C.teal },
        { icon: '🗑', label: 'Delete',       action: () => onDelete(art), color: C.red },
      ]
    : [
        { icon: '🔍', label: 'View Full', action: () => onLightbox(art), color: C.text },
        ...(art.license === 'royalty' || art.license === 'free'
          ? [{ icon: '🛍', label: 'Use This Art', action: () => onUseAgain(art), color: C.accent }]
          : []),
      ]

  return (
    <div className='ds-card' style={{ breakInside: 'avoid', marginBottom: 14, borderRadius: 14, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
      {/* Image */}
      <div style={{ position: 'relative' }} onClick={() => art.image_url && onLightbox(art)}>
        {art.image_url
          ? <LazyImage src={art.image_url} alt={artAltTag(art)} width={400} style={{ width: '100%' }}
              onBroken={(id) => setArtworks(prev => prev.filter(a => a.id !== id))}
              resourceId={art.id} resourceType="artwork" />
          : <div style={{ height: 160, background: `linear-gradient(135deg, ${C.accent}20, ${C.teal}15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🎨</div>
        }

        {/* License badge — top left */}
        {art.is_public && art.license && art.license !== 'private' && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(8,11,20,0.82)', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: art.license === 'royalty' ? C.gold : C.teal, pointerEvents: 'none' }}>
            {art.license === 'royalty' ? `✦ ${art.royalty_pct || 15}%` : '🎁'}
          </div>
        )}

        {/* ⋯ Kebab button — top right */}
        <div style={{ position: 'absolute', top: 6, right: 6 }} ref={menuRef} onClick={e => e.stopPropagation()}>
          <button onClick={() => setMenuOpen(o => !o)}
            style={{ background: 'rgba(8,11,20,0.82)', border: `1px solid ${menuOpen ? C.accent + '66' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, width: 30, height: 30, color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
            ⋯
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', top: 36, right: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, minWidth: 152, zIndex: 200, boxShadow: `0 8px 32px rgba(8,11,20,0.9), 0 0 0 1px ${C.accent}22`, overflow: 'hidden' }}>
              {menuItems.map((item, idx, arr) => (
                <button key={item.label} onClick={() => { setMenuOpen(false); item.action() }}
                  style={{ width: '100%', background: 'none', border: 'none', borderBottom: idx < arr.length - 1 ? `1px solid ${C.border}` : 'none', padding: '9px 13px', color: item.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{art.title}</div>
        <div style={{ fontSize: 11, color: C.muted, cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); if (art.profiles?.username) { if (e.ctrlKey || e.metaKey) { window.open(`/u/${art.profiles.username}`, '_blank', 'noopener,noreferrer') } else { navigate(`/u/${art.profiles.username}`) } } }}>
          @{art.profiles?.username || 'artist'}
        </div>
      </div>
    </div>
  )
}

// ── Edit Artwork Modal ────────────────────────────────────────
function EditArtworkModal({ art, onSave, onClose }) {
  const [title, setTitle]      = useState(art.title || '')
  const [description, setDesc] = useState(art.prompt || '')
  const [tags, setTags]        = useState((art.style_tags || []).join(', '))
  const [saving, setSaving]    = useState(false)
  const [error, setError]      = useState('')

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return }
    setError(''); setSaving(true)
    const styleTags = tags.split(',').map(t => t.trim()).filter(Boolean)
    const updates = { title: title.trim(), prompt: description.trim(), style_tags: styleTags }
    const { error: dbErr } = await supabase.from('artwork').update(updates).eq('id', art.id)
    if (dbErr) { setError('Failed to save.'); setSaving(false); return }
    onSave({ ...art, ...updates })
    onClose()
  }

  const inp = { width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(8,11,20,0.95)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 500, overflow: 'hidden', boxShadow: `0 0 60px rgba(124,92,252,0.2)` }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text, marginBottom: 2 }}>Edit Artwork</div>
            <div style={{ fontSize: 12, color: C.muted }}>Update title, description and tags</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {art.image_url && (
          <div style={{ height: 130, overflow: 'hidden', position: 'relative' }}>
            <img src={art.image_url} alt={art.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(19,24,38,0.9) 0%, transparent 60%)' }} />
          </div>
        )}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Title</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="Artwork title..." maxLength={100} style={inp} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Description</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} placeholder="Describe this artwork..." rows={3} maxLength={1000} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Style Tags</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. surrealism, dark, neon" style={inp} />
            {tags.trim() && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                {tags.split(',').map(t => t.trim()).filter(Boolean).map((tag, i) => (
                  <span key={i} style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11, color: C.accent }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
          {error && <div style={{ background: 'rgba(255,77,77,0.12)', border: '1px solid rgba(255,77,77,0.4)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: C.red }}>{error}</div>}
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: saving ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : '✦ Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Use Again Modal ───────────────────────────────────────────
function UseAgainModal({ art, isOwn, onClose, onSell }) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const copyPrompt = () => { navigator.clipboard.writeText(art.prompt || ''); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const hasRoyalty  = !isOwn && art.license === 'royalty'
  const isFreeUse   = !isOwn && art.license === 'free'
  const isPrivate   = !isOwn && (art.license === 'private' || !art.license)
  const canUse      = isOwn || hasRoyalty || isFreeUse

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(8,11,20,0.95)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, maxWidth: 540, width: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text }}>{canUse ? 'Use This Artwork' : 'View Artwork'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Image — protected for non-owners */}
        <div style={{ background: C.bg, maxHeight: 260, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {art.image_url && (
            <>
              <img src={art.image_url} alt={artAltTag(art)}
                onContextMenu={isOwn ? undefined : e => e.preventDefault()}
                onDragStart={isOwn ? undefined : e => e.preventDefault()}
                style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block', userSelect: 'none' }} />
              {!isOwn && <div onContextMenu={e => e.preventDefault()} style={{ position: 'absolute', inset: 0, background: 'transparent' }} />}
            </>
          )}
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{art.title}</h4>
            {art.profiles?.username && (
              <span style={{ fontSize: 12, color: C.accent, flexShrink: 0 }}>by @{art.profiles.username}</span>
            )}
          </div>

          {/* License notice */}
          {hasRoyalty && (
            <div style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}44`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>✦</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 2 }}>Royalty License — {art.royalty_pct || 15}% to the artist</div>
                <div style={{ fontSize: 11, color: C.muted }}>@{art.profiles?.username} will automatically earn {art.royalty_pct || 15}% of the profit from every product you sell using this artwork.</div>
              </div>
            </div>
          )}
          {isFreeUse && (
            <div style={{ background: `${C.teal}12`, border: `1px solid ${C.teal}44`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🎁</span>
              <div style={{ fontSize: 12, color: C.teal }}><strong>Free Use</strong> — @{art.profiles?.username} has made this artwork free to use. No royalty required.</div>
            </div>
          )}
          {isPrivate && (
            <div style={{ background: `${C.red}12`, border: `1px solid ${C.red}44`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🔒</span>
              <div style={{ fontSize: 12, color: C.red }}><strong>Private artwork</strong> — @{art.profiles?.username} has reserved this artwork exclusively. You can view and purchase products made from it in the Marketplace.</div>
            </div>
          )}

          {canUse && art.prompt && (
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.accent, textTransform: 'uppercase', letterSpacing: 1 }}>✦ Original Prompt</span>
                <button onClick={copyPrompt} style={{ background: copied ? `${C.teal}20` : 'none', border: `1px solid ${copied ? C.teal + '55' : C.border}`, borderRadius: 6, padding: '3px 10px', color: copied ? C.teal : C.muted, fontSize: 11, cursor: 'pointer' }}>
                  {copied ? '✅ Copied!' : 'Copy'}
                </button>
              </div>
              <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, margin: 0 }}>{art.prompt}</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: canUse ? '1fr 1fr' : '1fr', gap: 10, marginTop: 4 }}>
            {canUse && (
              <button onClick={() => { onSell(art); onClose() }}
                style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 12, padding: '13px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                🛍 {hasRoyalty ? `Sell (${art.royalty_pct || 15}% to artist)` : 'Sell This'}
              </button>
            )}
            {canUse && (
              <button onClick={() => { navigate('/create', { state: { reusePrompt: art.prompt, reuseImage: art.image_url } }); onClose() }}
                style={{ background: `${C.teal}20`, border: `1px solid ${C.teal}44`, borderRadius: 12, padding: '13px', color: C.teal, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                ✦ Remix in Dream
              </button>
            )}
            {/* Download only for own artwork */}
            {isOwn && (
              <a href={art.image_url} download={`${art.title || 'dreamscape'}.png`} target="_blank" rel="noreferrer"
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: '13px', color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                ↓ Download
              </a>
            )}
            <button onClick={() => { navigator.clipboard.writeText(`https://trydreamscape.com`) }}
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: '13px', color: C.muted, fontSize: 13, cursor: 'pointer', gridColumn: isPrivate ? '1' : undefined }}>
              🔗 Share
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Gallery ──────────────────────────────────────────────
export default function Gallery({ user, onSignIn }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const [artworks, setArtworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)
  const [createTarget, setCreateTarget] = useState(null)
  const [reuseTarget, setReuseTarget] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  useEffect(() => { loadArtworks() }, [tab, user])

  const loadArtworks = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('artwork')
        .select('*, profiles!user_id(id, username, watermark_enabled, watermark_text, watermark_style, watermark_opacity)')
        .order('created_at', { ascending: false })
        .limit(120)
      if (tab === 'mine') {
        if (!user) { setArtworks([]); setLoading(false); return }
        query = query.eq('user_id', user.id)
      } else {
        // Public gallery — only show is_public, non-broken artworks
        query = query.eq('is_public', true).or('broken_image.is.null,broken_image.eq.false')
      }
      const { data } = await query
      setArtworks(data || [])
    } catch {}
    setLoading(false)
  }

  const isOwn = (art) => user && art.user_id === user.id

  const handleDelete = async (art) => {
    setDeleting(true)
    await supabase.from('artwork').delete().eq('id', art.id)
    setArtworks(prev => prev.filter(a => a.id !== art.id))
    setDeleteConfirm(null)
    setDeleting(false)
  }

  const handleEditSave = (updated) => {
    setArtworks(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
    setEditTarget(null)
  }

  const openLightbox = (art) => {
    if (!art.image_url) return
    setLightbox({
      src: art.image_url,
      alt: artAltTag(art),
      title: art.title,
      username: art.profiles?.username,
      prompt: art.prompt,
      art,
    })
  }

  // Collect unique tags from all loaded artwork for the filter bar
  const allTags = [...new Set(artworks.flatMap(a => a.style_tags || []))].sort()

  const filtered = artworks.filter(a => {
    const matchSearch = !search || a.title?.toLowerCase().includes(search.toLowerCase()) || a.prompt?.toLowerCase().includes(search.toLowerCase())
    const matchTag = !activeTag || (a.style_tags || []).includes(activeTag)
    return matchSearch && matchTag
  })

  return (
    <div style={{ padding: '40px 20px', maxWidth: 1200, margin: '0 auto' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* Lightbox */}
      {lightbox && (
        <ImageLightbox
          image={lightbox}
          onClose={() => setLightbox(null)}
          onSell={isOwn(lightbox.art) ? () => { setCreateTarget(lightbox.art); setLightbox(null) } : null}
          isOwn={isOwn(lightbox.art)}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, color: C.text, marginBottom: 8 }}>Gallery</h1>
        <p style={{ color: C.muted, fontSize: 14 }}>Every artwork is yours to reuse, sell, or remix — forever.</p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['all', '✦ All'], ['mine', '🎨 My Art']].map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setActiveTag('') }}
              style={{ background: tab === id ? `${C.accent}20` : 'none', border: `1px solid ${tab === id ? C.accent + '55' : C.border}`, borderRadius: 8, padding: '8px 16px', color: tab === id ? C.accent : C.muted, fontSize: 13, fontWeight: tab === id ? 700 : 400, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => { setSearch(e.target.value); setActiveTag('') }} placeholder="Search artwork..."
          style={{ flex: 1, minWidth: 160, maxWidth: 280, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 14px', color: C.text, fontSize: 13, outline: 'none' }} />
        <button onClick={() => navigate('/create')}
          style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '9px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>
          ✦ Create New
        </button>
      </div>

      {/* Tag filter chips — dynamic from loaded artwork */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          <button onClick={() => setActiveTag('')}
            style={{ background: !activeTag ? `${C.accent}20` : 'none', border: `1px solid ${!activeTag ? C.accent+'55' : C.border}`, borderRadius: 20, padding: '4px 12px', color: !activeTag ? C.accent : C.muted, fontSize: 11, fontWeight: !activeTag ? 700 : 400, cursor: 'pointer' }}>
            All
          </button>
          {allTags.slice(0, 20).map(tag => (
            <button key={tag} onClick={() => setActiveTag(tag === activeTag ? '' : tag)}
              style={{ background: activeTag === tag ? `${C.accent}20` : 'none', border: `1px solid ${activeTag === tag ? C.accent+'55' : C.border}`, borderRadius: 20, padding: '4px 12px', color: activeTag === tag ? C.accent : C.muted, fontSize: 11, fontWeight: activeTag === tag ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
              {tag}
            </button>
          ))}
          <span style={{ fontSize: 11, color: C.muted, alignSelf: 'center', marginLeft: 4 }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* My Art tip */}
      {tab === 'mine' && user && !loading && artworks.length > 0 && (
        <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>💡</span>
          Hover any artwork to <strong style={{ color: C.accent }}>Sell This</strong>, <strong style={{ color: C.teal }}>Remix</strong>, or download — or click any image to view full size.
        </div>
      )}

      {tab === 'mine' && !user ? (
        <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '32px', textAlign: 'center', marginBottom: 24 }}>
          <p style={{ color: C.text, marginBottom: 16, fontSize: 15 }}>Sign in to see your artwork library</p>
          <button onClick={onSignIn} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sign In</button>
        </div>
      ) : loading ? <Spinner cards={6} /> : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🎨</div>
          <p style={{ color: C.muted, fontSize: 15, marginBottom: 20 }}>
            {tab === 'mine' ? "You haven't created any artwork yet." : (search || activeTag) ? 'No artwork matches your filters.' : 'No artwork yet — be the first to create!'}
          </p>
          <button onClick={() => navigate('/create')}
            style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '11px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Start Creating ✦
          </button>
        </div>
      ) : (
        <div style={{ columns: 'auto 260px', columnGap: 14 }}>
          {filtered.map(art => (
            <ArtCard
              key={art.id}
              art={art}
              isOwn={isOwn(art)}
              onLightbox={openLightbox}
              onSell={setCreateTarget}
              onUseAgain={setReuseTarget}
              onDelete={setDeleteConfirm}
              onEdit={setEditTarget}
            />
          ))}
        </div>
      )}

      {/* Edit Artwork Modal */}
      {editTarget && (
        <EditArtworkModal
          art={editTarget}
          onSave={handleEditSave}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Use Again Modal */}
      {reuseTarget && (
        <UseAgainModal
          art={reuseTarget}
          isOwn={reuseTarget && user && reuseTarget.user_id === user?.id}
          onClose={() => setReuseTarget(null)}
          onSell={(art) => { setCreateTarget(art); setReuseTarget(null) }}
        />
      )}

      {/* Create Product Modal */}
      {createTarget && (
        <CreateProductModal
          user={user}
          imageUrl={createTarget.image_url}
          artworkId={createTarget.id}
          title={createTarget.title}
          onClose={() => setCreateTarget(null)}
          onSuccess={() => { setCreateTarget(null) }}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(8,11,20,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '36px 32px', maxWidth: 380, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🗑️</div>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text, marginBottom: 8 }}>Delete this artwork?</h3>
            <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
              This will remove <strong style={{ color: C.text }}>"{deleteConfirm.title}"</strong> from your gallery permanently. Any products made from this artwork will keep their mockup images.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Keep It</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting}
                style={{ flex: 1, background: 'linear-gradient(135deg, #FF4D4D, #CC0000)', border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
