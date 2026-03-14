import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { supabase } from './lib/supabase'
import AuthModal from './components/AuthModal'
import ProfileSetup from './components/ProfileSetup'
import Marketplace from './components/Marketplace'
import Channels from './components/Channels'
import Gallery from './components/Gallery'
import CreateProductModal from './components/CreateProductModal'
import OrderHistory from './components/OrderHistory'
import Pricing from './components/Pricing'
import Admin from './components/Admin'
import Privacy from './components/Privacy'
import Sitemap from './components/Sitemap'
import Blog from './components/Blog'
import BlogPost from './components/BlogPost'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
}

// ── Starfield Background ──────────────────────────────────────
function StarField() {
  const stars = Array.from({ length: 120 }, (_, i) => ({
    id: i,
    top: Math.random() * 100,
    left: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    duration: Math.random() * 4 + 2,
    delay: Math.random() * 5,
    opacity: Math.random() * 0.6 + 0.1,
  }))
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: var(--base-opacity); transform: scale(1); }
          50% { opacity: calc(var(--base-opacity) * 0.15); transform: scale(0.7); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      {stars.map(s => (
        <div key={s.id} style={{
          position: 'absolute',
          top: `${s.top}%`,
          left: `${s.left}%`,
          width: s.size,
          height: s.size,
          borderRadius: '50%',
          background: '#fff',
          '--base-opacity': s.opacity,
          opacity: s.opacity,
          animation: `twinkle ${s.duration}s ease-in-out infinite`,
          animationDelay: `${s.delay}s`,
        }} />
      ))}
    </div>
  )
}

// ── Meta tag helper ───────────────────────────────────────────
function useMeta({ title, description, image } = {}) {
  useEffect(() => {
    const base = 'Dreamscape — AI Artist Platform'
    document.title = title ? `${title} | ${base}` : base
    const setMeta = (property, content, attr = 'property') => {
      if (!content) return
      let el = document.querySelector(`meta[${attr}="${property}"]`)
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, property); document.head.appendChild(el) }
      el.setAttribute('content', content)
    }
    const desc = description || 'Generate AI art, connect with artists worldwide, and sell merchandise globally.'
    const img = image || 'https://trydreamscape.com/og-image.png'
    setMeta('description', desc, 'name')
    setMeta('og:title', title ? `${title} | ${base}` : base)
    setMeta('og:description', desc)
    setMeta('og:image', img)
    setMeta('og:url', window.location.href)
    setMeta('og:type', 'website')
    setMeta('twitter:card', 'summary_large_image', 'name')
    setMeta('twitter:title', title ? `${title} | ${base}` : base, 'name')
    setMeta('twitter:description', desc, 'name')
    setMeta('twitter:image', img, 'name')
  }, [title, description, image])
}

// ── GA4 Page View Tracking ────────────────────────────────────
function usePageTracking() {
  const location = useLocation()
  useEffect(() => {
    if (typeof window.gtag !== 'function') return
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
    })
  }, [location])
}


function Spinner() {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '40px 0' }}>
      {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
    </div>
  )
}

// ── Save Modal ────────────────────────────────────────────────
function SaveModal({ prompt, imageUrl, onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!title.trim()) return setError('Please give your artwork a title.')
    setError(''); setSaving(true)
    const styleTags = tags.split(',').map(t => t.trim()).filter(Boolean)
    await onSave({ title: title.trim(), prompt, styleTags, imageUrl })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(8,11,20,0.92)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '32px 36px', maxWidth: 480, width: '100%' }}>
        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 4 }}>Save to Gallery</h3>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>This prompt will be saved to your artwork gallery.</p>
        {imageUrl && <img src={imageUrl} alt="Preview" style={{ width: '100%', borderRadius: 10, marginBottom: 16, maxHeight: 160, objectFit: 'cover' }} />}
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 12, color: C.muted, lineHeight: 1.6, maxHeight: 80, overflow: 'hidden' }}>
          {prompt.slice(0, 200)}{prompt.length > 200 ? '...' : ''}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Title</label>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="e.g. Cosmic Dreamscape #1"
            style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Style Tags <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. surrealism, dark, neon"
            style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        {error && <div style={{ background: '#ff6b6b18', border: '1px solid #ff6b6b44', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ff6b6b' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: saving ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save to Gallery ✦'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dream AI Chat ─────────────────────────────────────────────
function DreamChat({ user, onSignIn }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "✦ Hey, I'm Dream — your AI creative companion. Describe what you want to create and I'll help you bring it to life with a perfect prompt. What are we making today?" },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saveTarget, setSaveTarget] = useState(null)
  const [savedIndexes, setSavedIndexes] = useState(new Set())
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [generatingIndex, setGeneratingIndex] = useState(null)
  const [generatedImages, setGeneratedImages] = useState({})
  const [lightboxImage, setLightboxImage] = useState(null)
  const [createProductImage, setCreateProductImage] = useState(null)
  const [bottomEl, setBottomEl] = useState(null)
  const [referenceImage, setReferenceImage] = useState(null) // { dataUrl, mimeType, name }
  const fileInputRef = useRef(null)

  useEffect(() => { bottomEl?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setReferenceImage({ dataUrl: ev.target.result, mimeType: file.type, name: file.name })
    }
    reader.readAsDataURL(file)
    e.target.value = '' // reset so same file can be re-selected
  }

  const send = async () => {
    if (!input.trim() || loading) return

    // Build user message — with image if attached
    let userContent
    if (referenceImage) {
      const base64 = referenceImage.dataUrl.split(',')[1]
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: referenceImage.mimeType, data: base64 } },
        { type: 'text', text: input.trim() },
      ]
    } else {
      userContent = input.trim()
    }

    const userMsg = { role: 'user', content: userContent, _refImage: referenceImage?.dataUrl }
    const history = [...messages.filter((_, i) => i > 0), { role: 'user', content: userContent }]
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setReferenceImage(null)
    setLoading(true)
    try {
      const res = await fetch('/api/dream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history }) })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Something went wrong.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally { setLoading(false) }
  }

  const handleSave = async ({ title, prompt, styleTags, imageUrl }) => {
    const { error } = await supabase.from('artwork').insert({ user_id: user.id, title, prompt, image_url: imageUrl || '', style_tags: styleTags })
    if (!error) {
      setSavedIndexes(prev => new Set([...prev, saveTarget.index]))
      setSaveTarget(null); setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  const generateImage = async (prompt, index) => {
    setGeneratingIndex(index)
    // Find the most recent user reference image to use as generation reference
    const lastUserWithImage = [...messages].reverse().find(m => m._refImage)
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          resolution: '1K',
          referenceImage: lastUserWithImage?._refImage || null,
        })
      })
      const data = await res.json()
      if (data.success) setGeneratedImages(prev => ({ ...prev, [index]: `data:${data.mimeType};base64,${data.imageData}` }))
      else alert('Image generation failed: ' + (data.error || 'Unknown'))
    } catch { alert('Connection error.') }
    finally { setGeneratingIndex(null) }
  }

  const lastAiIndex = messages.reduce((last, msg, i) => msg.role === 'assistant' && i > 0 ? i : last, -1)

  if (!user) return (
    <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 16, padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>✦</div>
      <p style={{ color: C.text, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>Meet Dream AI</p>
      <p style={{ color: C.muted, marginBottom: 24, fontSize: 14 }}>Your creative companion for AI art generation</p>
      <button onClick={onSignIn} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '12px 28px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Sign In to Create ✦</button>
    </div>
  )

  return (
    <>
      {saveSuccess && <div style={{ background: `${C.teal}18`, border: `1px solid ${C.teal}55`, borderRadius: 10, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: C.teal }}>✅ Saved to your gallery!</div>}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✦</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Dream AI</div>
            <div style={{ fontSize: 11, color: C.teal }}>● online</div>
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 300, maxHeight: '55vh' }}>
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            const textContent = typeof msg.content === 'string' ? msg.content : msg.content?.find?.(c => c.type === 'text')?.text || ''
            return (
              <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 6 }}>
                  {/* Reference image thumbnail in message */}
                  {isUser && msg._refImage && (
                    <img src={msg._refImage} alt="Reference" style={{ width: 120, height: 120, borderRadius: 10, objectFit: 'cover', border: `1px solid ${C.accent}55` }} />
                  )}
                  <div style={{ padding: '10px 14px', borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: isUser ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : C.panel, border: isUser ? 'none' : `1px solid ${C.border}`, fontSize: 13, lineHeight: 1.6, color: C.text, whiteSpace: 'pre-wrap' }}>
                    {textContent}
                  </div>
                </div>
              </div>
            )
          })}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px 12px 12px 4px', padding: '10px 16px', display: 'flex', gap: 4 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
              </div>
            </div>
          )}
          <div ref={el => setBottomEl(el)} />
        </div>
        {lastAiIndex >= 0 && !loading && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.panel, flexShrink: 0 }}>
            {generatedImages[lastAiIndex] ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <img src={generatedImages[lastAiIndex]} alt="Generated" onClick={() => setLightboxImage(generatedImages[lastAiIndex])}
                  style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.teal}55`, cursor: 'zoom-in' }} />
                <span style={{ fontSize: 12, color: C.teal, flex: 1 }}>✅ Image ready! <span style={{ color: C.muted, fontSize: 11 }}>(click to preview)</span></span>
                <button onClick={() => !savedIndexes.has(lastAiIndex) && setSaveTarget({ prompt: messages[lastAiIndex].content, index: lastAiIndex, imageUrl: generatedImages[lastAiIndex] })}
                  style={{ background: savedIndexes.has(lastAiIndex) ? 'none' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: `1px solid ${savedIndexes.has(lastAiIndex) ? C.teal + '55' : 'transparent'}`, borderRadius: 8, padding: '7px 13px', color: savedIndexes.has(lastAiIndex) ? C.teal : '#fff', fontSize: 12, fontWeight: 700, cursor: savedIndexes.has(lastAiIndex) ? 'default' : 'pointer' }}>
                  {savedIndexes.has(lastAiIndex) ? '✅ Saved' : '✦ Save'}
                </button>
                <button onClick={() => setCreateProductImage(generatedImages[lastAiIndex])}
                  style={{ background: `${C.teal}22`, border: `1px solid ${C.teal}55`, borderRadius: 8, padding: '7px 13px', color: C.teal, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  🛍 Sell
                </button>
                <a href={generatedImages[lastAiIndex]} download="dreamscape-art.png" target="_blank"
                  style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', color: C.muted, fontSize: 12, cursor: 'pointer', textDecoration: 'none' }}>
                  ↓
                </a>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>Happy with this prompt?</span>
                <button onClick={() => generatingIndex === null && generateImage(messages[lastAiIndex].content, lastAiIndex)} disabled={generatingIndex !== null}
                  style={{ background: generatingIndex !== null ? C.border : `${C.teal}22`, border: `1px solid ${generatingIndex !== null ? C.border : C.teal + '66'}`, borderRadius: 8, padding: '7px 14px', color: generatingIndex !== null ? C.muted : C.teal, fontSize: 12, fontWeight: 600, cursor: generatingIndex !== null ? 'not-allowed' : 'pointer' }}>
                  {generatingIndex !== null ? '⏳ Generating...' : '✦ Generate Image'}
                </button>
                <button onClick={() => !savedIndexes.has(lastAiIndex) && setSaveTarget({ prompt: messages[lastAiIndex].content, index: lastAiIndex, imageUrl: '' })}
                  style={{ background: 'none', border: `1px solid ${savedIndexes.has(lastAiIndex) ? C.teal + '55' : C.border}`, borderRadius: 8, padding: '7px 14px', color: savedIndexes.has(lastAiIndex) ? C.teal : C.muted, fontSize: 12, cursor: savedIndexes.has(lastAiIndex) ? 'default' : 'pointer' }}>
                  {savedIndexes.has(lastAiIndex) ? '✅ Saved' : '✦ Save Prompt'}
                </button>
              </div>
            )}
          </div>
        )}
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          {/* Reference image preview */}
          {referenceImage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, background: C.bg, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: '8px 12px' }}>
              <img src={referenceImage.dataUrl} alt="Reference" style={{ width: 40, height: 40, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.accent }}>Reference image attached</div>
                <div style={{ fontSize: 10, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{referenceImage.name}</div>
              </div>
              <button onClick={() => setReferenceImage(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}>✕</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()}
              title="Attach reference image"
              style={{ background: referenceImage ? `${C.accent}22` : 'none', border: `1px solid ${referenceImage ? C.accent + '66' : C.border}`, borderRadius: 10, padding: '10px 12px', color: referenceImage ? C.accent : C.muted, fontSize: 16, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>
              📎
            </button>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Describe your vision or ask Dream anything..."
              style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={send} disabled={loading || !input.trim()} style={{ background: loading || !input.trim() ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer' }}>✦</button>
          </div>
        </div>
      </div>
      {saveTarget && <SaveModal prompt={saveTarget.prompt} imageUrl={saveTarget.imageUrl} onSave={handleSave} onClose={() => setSaveTarget(null)} />}
      {lightboxImage && (
        <div onClick={() => setLightboxImage(null)} style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(8,11,20,0.97)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
          <div style={{ position: 'relative', maxWidth: 800, width: '100%' }}>
            <img src={lightboxImage} alt="Preview" style={{ width: '100%', borderRadius: 16, boxShadow: `0 0 80px ${C.accent}33`, display: 'block' }} />
            <button onClick={() => setLightboxImage(null)} style={{ position: 'absolute', top: -14, right: -14, background: C.card, border: `1px solid ${C.border}`, borderRadius: '50%', width: 36, height: 36, color: C.text, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
              <button onClick={e => { e.stopPropagation(); setCreateProductImage(lightboxImage); setLightboxImage(null) }}
                style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 22px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🛍 Sell This</button>
              <a href={lightboxImage} download="dreamscape-art.png" target="_blank" onClick={e => e.stopPropagation()}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 18px', color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'none' }}>↓ Download</a>
            </div>
          </div>
        </div>
      )}
      {createProductImage && user && (
        <CreateProductModal
          user={user}
          imageUrl={createProductImage}
          title=""
          onClose={() => setCreateProductImage(null)}
          onSuccess={() => setCreateProductImage(null)}
        />
      )}
    </>
  )
}

// ── Artwork Grid ──────────────────────────────────────────────
function ArtworkGrid({ artworks, loading }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(null)
  if (loading) return <Spinner />
  if (!artworks.length) return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🎨</div>
      <p style={{ color: C.muted, fontSize: 14 }}>No artworks yet.</p>
    </div>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
      {artworks.map(art => (
        <div key={art.id} onClick={() => setExpanded(expanded === art.id ? null : art.id)}
          style={{ background: C.card, border: `1px solid ${expanded === art.id ? C.accent + '88' : C.border}`, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '55'}
          onMouseLeave={e => e.currentTarget.style.borderColor = expanded === art.id ? C.accent + '88' : C.border}>
          <div style={{ height: 160, background: `linear-gradient(135deg, ${C.accent}30, ${C.teal}20)`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
            {art.image_url ? <img src={art.image_url} alt={art.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎨'}
          </div>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{art.title}</div>
            {art.profiles?.username && (
              <div onClick={e => { e.stopPropagation(); navigate(`/u/${art.profiles.username}`) }}
                style={{ fontSize: 11, color: C.accent, marginBottom: 6, cursor: 'pointer' }}>@{art.profiles.username}</div>
            )}
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, overflow: 'hidden', maxHeight: expanded === art.id ? 300 : 36, transition: 'max-height 0.3s' }}>{art.prompt}</div>
            {art.style_tags?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {art.style_tags.map(tag => <span key={tag} style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11, color: C.accent }}>{tag}</span>)}
              </div>
            )}
            <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>{new Date(art.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Edit Profile Modal ────────────────────────────────────────
function EditProfileModal({ user, profile, onClose, onSave }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [location, setLocation] = useState(profile?.location || '')
  const [website, setWebsite] = useState(profile?.website || '')
  const [artistStatement, setArtistStatement] = useState(profile?.artist_statement || '')
  const [styleTags, setStyleTags] = useState((profile?.style_tags || []).join(', '))
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null)
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(profile?.banner_url || null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState('basic')
  const avatarRef = useRef(null)
  const bannerRef = useRef(null)

  const handleImageSelect = (file, type) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      if (type === 'avatar') { setAvatarPreview(e.target.result); setAvatarFile(file) }
      else { setBannerPreview(e.target.result); setBannerFile(file) }
    }
    reader.readAsDataURL(file)
  }

  const uploadImage = async (file, bucket, path) => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
    return publicUrl
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      let avatarUrl = profile?.avatar_url || null
      let bannerUrl = profile?.banner_url || null

      if (avatarFile) avatarUrl = await uploadImage(avatarFile, 'avatars', `${user.id}/avatar`)
      if (bannerFile) bannerUrl = await uploadImage(bannerFile, 'banners', `${user.id}/banner`)

      const tags = styleTags.split(',').map(t => t.trim()).filter(Boolean)
      const updates = {
        id: user.id,
        username: profile?.username, // preserve existing username — required field
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
        artist_statement: artistStatement.trim() || null,
        style_tags: tags,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        updated_at: new Date().toISOString(),
      }
      const { error: upsertErr } = await supabase.from('profiles').upsert(updates)
      if (upsertErr) throw upsertErr
      onSave(updates)
      onClose()
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    }
    setSaving(false)
  }

  const sections = [['basic', '👤 Basic'], ['artist', '🎨 Artist'], ['images', '🖼 Images']]

  const inputStyle = { width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(8,11,20,0.95)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text }}>Edit Profile</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {/* Section tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 24px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {sections.map(([id, label]) => (
            <button key={id} onClick={() => setActiveSection(id)}
              style={{ background: activeSection === id ? `${C.accent}20` : 'none', border: `1px solid ${activeSection === id ? C.accent + '55' : 'transparent'}`, borderRadius: 8, padding: '6px 14px', color: activeSection === id ? C.accent : C.muted, fontSize: 12, fontWeight: activeSection === id ? 700 : 400, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
          {activeSection === 'basic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Display Name</label>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your full name or artist name" maxLength={60} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Bio <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(160 chars)</span></label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="A short intro about you..." maxLength={160} rows={3} style={{ ...inputStyle, resize: 'none' }} />
                <div style={{ fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 4 }}>{bio.length}/160</div>
              </div>
              <div>
                <label style={labelStyle}>Location</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" maxLength={80} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Website / Social Link</label>
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yoursite.com" maxLength={200} style={inputStyle} />
              </div>
            </div>
          )}
          {activeSection === 'artist' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Artist Statement</label>
                <textarea value={artistStatement} onChange={e => setArtistStatement(e.target.value)} placeholder="Tell the world about your work, your inspiration, your process..." maxLength={600} rows={6} style={{ ...inputStyle, resize: 'none' }} />
                <div style={{ fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 4 }}>{artistStatement.length}/600</div>
              </div>
              <div>
                <label style={labelStyle}>Style Tags <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(comma separated)</span></label>
                <input value={styleTags} onChange={e => setStyleTags(e.target.value)} placeholder="Surrealism, Abstract, Digital, Dark Fantasy..." style={inputStyle} />
                {styleTags && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {styleTags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                      <span key={tag} style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: C.accent }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {activeSection === 'images' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Avatar */}
              <div>
                <label style={labelStyle}>Profile Picture</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div onClick={() => avatarRef.current?.click()} style={{ width: 80, height: 80, borderRadius: '50%', background: avatarPreview ? 'transparent' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: `2px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
                    {avatarPreview ? <img src={avatarPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 28, color: '#fff' }}>{profile?.username?.[0]?.toUpperCase() || '?'}</span>}
                  </div>
                  <div>
                    <button onClick={() => avatarRef.current?.click()} style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: '7px 16px', color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'block', marginBottom: 6 }}>Upload Photo</button>
                    <div style={{ fontSize: 11, color: C.muted }}>JPG, PNG or WebP. Square works best.</div>
                  </div>
                </div>
                <input ref={avatarRef} type="file" accept="image/*" onChange={e => handleImageSelect(e.target.files?.[0], 'avatar')} style={{ display: 'none' }} />
              </div>
              {/* Banner */}
              <div>
                <label style={labelStyle}>Banner Image</label>
                <div onClick={() => bannerRef.current?.click()} style={{ width: '100%', height: 120, borderRadius: 12, background: bannerPreview ? 'transparent' : `linear-gradient(135deg, ${C.accent}20, ${C.teal}20)`, border: `2px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
                  {bannerPreview ? <img src={bannerPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>🖼</div>
                      <div style={{ fontSize: 12, color: C.muted }}>Click to upload banner</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Recommended: 1500×500px</div>
                    </div>
                  )}
                </div>
                <input ref={bannerRef} type="file" accept="image/*" onChange={e => handleImageSelect(e.target.files?.[0], 'banner')} style={{ display: 'none' }} />
                <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>💡 Recommended size: <span style={{ color: C.text }}>1500×500px</span> (3:1 ratio) · JPG, PNG or WebP · The center of the image shows best on all screens.</div>
              </div>
            </div>
          )}
        </div>
        {/* Footer */}
        {error && <div style={{ margin: '0 24px', background: '#ff6b6b18', border: '1px solid #ff6b6b44', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ff6b6b', flexShrink: 0 }}>{error}</div>}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: saving ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save Profile ✦'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Share Button ──────────────────────────────────────────────
function ShareButton({ username }) {
  const [copied, setCopied] = useState(false)
  const url = `https://trydreamscape.com/u/${username}`
  const handleCopy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy}
      style={{ background: copied ? `${C.teal}20` : 'none', border: `1px solid ${copied ? C.teal + '55' : C.border}`, borderRadius: 10, padding: '8px 16px', color: copied ? C.teal : C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
      {copied ? '✅ Copied!' : '🔗 Share Profile'}
    </button>
  )
}

// ── Profile Header (shared by ProfilePage + ArtistProfilePage) ─
function ProfileHeader({ profile, artworkCount, followerCount, followingCount, salesCount, isOwnProfile, viewerUser, onEdit, onFollow, followLoading, isFollowing }) {
  const navigate = useNavigate()
  const avatarLetter = profile?.username?.[0]?.toUpperCase() || '?'
  const tags = profile?.style_tags || []
  const joinedDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null

  return (
    <div style={{ marginBottom: 0 }}>
      {/* Banner */}
      <div style={{ width: '100%', height: 180, borderRadius: '16px 16px 0 0', background: profile?.banner_url ? 'transparent' : `linear-gradient(135deg, ${C.accent}30, ${C.teal}20, #FF6B9D18)`, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {profile?.banner_url && <img src={profile.banner_url} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {isOwnProfile && (
          <button onClick={onEdit} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(8,11,20,0.7)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.text, fontSize: 12, cursor: 'pointer', backdropFilter: 'blur(8px)' }}>✏️ Edit Profile</button>
        )}
      </div>

      {/* Profile card */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 16px 16px', padding: '0 24px 24px' }}>
        {/* Avatar row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ width: 92, height: 92, borderRadius: '50%', background: profile?.avatar_url ? '#0E1220' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: `3px solid ${C.bg}`, outline: `2px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: '#fff', overflow: 'hidden', marginTop: -46, flexShrink: 0, position: 'relative', zIndex: 2 }}>
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : avatarLetter}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isOwnProfile && (
              <button onClick={onEdit} style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: '8px 18px', color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✏️ Edit Profile</button>
            )}
            {!isOwnProfile && viewerUser && (
              <button onClick={onFollow} disabled={followLoading} style={{ background: isFollowing ? 'none' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: `1px solid ${isFollowing ? C.border : 'transparent'}`, borderRadius: 10, padding: '8px 20px', color: isFollowing ? C.muted : '#fff', fontSize: 13, fontWeight: 600, cursor: followLoading ? 'not-allowed' : 'pointer' }}>
                {followLoading ? '...' : isFollowing ? 'Following ✓' : '+ Follow'}
              </button>
            )}
            {!isOwnProfile && !viewerUser && (
              <button onClick={() => navigate('/')} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '8px 20px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Follow</button>
            )}
            <ShareButton username={profile?.username} />
          </div>
        </div>

        {/* Name + username + meta */}
        <div style={{ marginBottom: 12 }}>
          {profile?.display_name && <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 2 }}>{profile.display_name}</div>}
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 8 }}>@{profile?.username}</div>
          {profile?.bio && <p style={{ fontSize: 14, color: C.text, lineHeight: 1.6, marginBottom: 10, maxWidth: 560 }}>{profile.bio}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: C.muted }}>
            {profile?.location && <span>📍 {profile.location}</span>}
            {profile?.website && <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" style={{ color: C.accent, textDecoration: 'none' }}>🔗 {profile.website.replace(/^https?:\/\//, '')}</a>}
            {joinedDate && <span>📅 Joined {joinedDate}</span>}
          </div>
        </div>

        {/* Style tags */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {tags.map(tag => (
              <span key={tag} style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}33`, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: C.accent }}>{tag}</span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          {[[artworkCount, 'Artworks'], [followerCount, 'Followers'], [followingCount, 'Following'], [salesCount, 'Sales']].map(([count, label]) => (
            <div key={label}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, fontFamily: 'Playfair Display, serif' }}>{count ?? '—'}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Profile Tabs ──────────────────────────────────────────────
function ProfileTabs({ tab, setTab, tabs }) {
  return (
    <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
      {tabs.map(([id, label]) => (
        <button key={id} onClick={() => setTab(id)}
          style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === id ? C.accent : 'transparent'}`, padding: '10px 18px', color: tab === id ? C.accent : C.muted, fontSize: 13, fontWeight: tab === id ? 700 : 400, cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s' }}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Mini Product Card (for Shop tab) ─────────────────────────
function ShopCard({ product }) {
  const [buying, setBuying] = useState(false)
  const navigate = useNavigate()

  const handleBuy = async () => {
    setBuying(true)
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { alert('Checkout failed.') }
    setBuying(false)
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s', cursor: 'pointer' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '55'}
      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
      <div style={{ aspectRatio: '1', background: `linear-gradient(135deg, ${C.accent}18, ${C.teal}18)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {product.mockup_url ? <img src={product.mockup_url} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 40 }}>🎨</span>}
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4, lineHeight: 1.3 }}>{product.title}</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{product.product_type}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.gold, fontFamily: 'Playfair Display, serif' }}>${parseFloat(product.price || 0).toFixed(2)}</span>
          <button onClick={handleBuy} disabled={buying} style={{ background: buying ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: buying ? 'not-allowed' : 'pointer' }}>
            {buying ? '...' : 'Buy'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── My Profile Page (/profile) ────────────────────────────────
function ProfilePage({ user, profile: initialProfile }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(initialProfile)

  // Sync if auth context loads profile after component mounts
  useEffect(() => { if (initialProfile) setProfile(initialProfile) }, [initialProfile])
  const [artworks, setArtworks] = useState([])
  const [products, setProducts] = useState([])
  const [feedArtworks, setFeedArtworks] = useState([])
  const [featuredArtworks, setFeaturedArtworks] = useState([])
  const [loadingArt, setLoadingArt] = useState(true)
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [salesCount, setSalesCount] = useState(0)
  const [tab, setTab] = useState('artwork')
  const [showEdit, setShowEdit] = useState(false)

  useMeta({ title: `@${profile?.username || 'Profile'}`, description: profile?.bio })

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  const loadAll = async () => {
    const [
      { data: art },
      { data: prods },
      { count: followers },
      { count: following },
      { count: sales },
    ] = await Promise.all([
      supabase.from('artwork').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', user.id),
      supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', user.id),
      supabase.from('orders').select('id', { count: 'exact' }).eq('user_id', user.id),
    ])
    setArtworks(art || [])
    setProducts(prods || [])
    setFollowerCount(followers || 0)
    setFollowingCount(following || 0)
    setSalesCount(sales || 0)
    setLoadingArt(false)

    // Load featured artworks
    const featuredIds = profile?.featured_artwork_ids || []
    if (featuredIds.length && art?.length) {
      setFeaturedArtworks(art.filter(a => featuredIds.includes(a.id)))
    }

    // Load following feed
    setLoadingFeed(true)
    const { data: followRows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id)
    if (followRows?.length) {
      const ids = followRows.map(r => r.following_id)
      const { data: feedArt } = await supabase.from('artwork').select('*, profiles(username, avatar_url)').in('user_id', ids).order('created_at', { ascending: false }).limit(40)
      setFeedArtworks(feedArt || [])
    }
    setLoadingFeed(false)
  }

  const handleSaveProfile = (updates) => {
    setProfile(prev => ({ ...prev, ...updates }))
  }

  const tabs = [
    ['artwork', `🎨 Artwork (${loadingArt ? '…' : artworks.length})`],
    ['shop', `🛍 Shop (${products.length})`],
    ['about', '✦ About'],
    ['feed', '👥 Following Feed'],
  ]

  return (
    <div style={{ padding: '32px 16px', maxWidth: 960, margin: '0 auto' }}>
      <ProfileHeader
        profile={profile}
        artworkCount={artworks.length}
        followerCount={followerCount}
        followingCount={followingCount}
        salesCount={salesCount}
        isOwnProfile={true}
        viewerUser={user}
        onEdit={() => setShowEdit(true)}
      />

      <div style={{ height: 28 }} />
      <ProfileTabs tab={tab} setTab={setTab} tabs={tabs} />

      {tab === 'artwork' && (
        <>
          {featuredArtworks.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>⭐ Featured</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {featuredArtworks.map(art => (
                  <div key={art.id} style={{ background: C.card, border: `1px solid ${C.accent}44`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ height: 140, background: `linear-gradient(135deg, ${C.accent}30, ${C.teal}20)`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {art.image_url ? <img src={art.image_url} alt={art.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 36 }}>🎨</span>}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{art.title}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: C.border, margin: '24px 0' }} />
            </div>
          )}
          <ArtworkGrid artworks={artworks} loading={loadingArt} />
        </>
      )}

      {tab === 'shop' && (
        products.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛍</div>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>You haven't listed any products yet.</p>
            <button onClick={() => navigate('/create')} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create a Product ✦</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {products.map(p => <ShopCard key={p.id} product={p} />)}
          </div>
        )
      )}

      {tab === 'about' && (
        <div style={{ maxWidth: 640 }}>
          {/* Subscription card */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Subscription</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                {(() => {
                  const tier = profile?.subscription_tier || 'free'
                  const colors = { free: C.muted, starter: C.teal, pro: C.accent, studio: C.gold }
                  const color = colors[tier] || C.muted
                  return (
                    <div>
                      <span style={{ background: color + '20', border: `1px solid ${color}44`, borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700, color, textTransform: 'capitalize' }}>✦ {tier} Plan</span>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
                        {tier === 'free' ? 'Upgrade to start selling and earning.' : `Active — ${tier === 'starter' ? '25%' : tier === 'pro' ? '20%' : '15%'} Dreamscape commission`}
                      </div>
                    </div>
                  )
                })()}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(!profile?.subscription_tier || profile.subscription_tier === 'free') && (
                  <button onClick={() => navigate('/pricing')} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '8px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⬆ Upgrade</button>
                )}
                {profile?.subscription_tier && profile.subscription_tier !== 'free' && (
                  <button onClick={async () => {
                    const res = await fetch('/api/customer-portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) })
                    const data = await res.json()
                    if (data.url) window.location.href = data.url
                  }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 18px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Manage Plan</button>
                )}
              </div>
            </div>
          </div>
          {profile?.artist_statement ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 32px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Artist Statement</div>
              <p style={{ color: C.text, fontSize: 15, lineHeight: 1.8 }}>{profile.artist_statement}</p>
            </div>
          ) : (
            <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 16, padding: '32px', textAlign: 'center', marginBottom: 20 }}>
              <p style={{ color: C.muted, fontSize: 14, marginBottom: 16 }}>No artist statement yet.</p>
              <button onClick={() => setShowEdit(true)} style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: '8px 18px', color: C.accent, fontSize: 13, cursor: 'pointer' }}>Add Statement ✦</button>
            </div>
          )}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Details</div>
            {[
              ['Username', `@${profile?.username}`],
              ['Display Name', profile?.display_name],
              ['Location', profile?.location],
              ['Website', profile?.website],
              ['Member Since', profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 14 }}>
                <span style={{ color: C.muted, minWidth: 110 }}>{label}</span>
                <span style={{ color: C.text }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'feed' && (
        followingCount === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>You're not following anyone yet. Find artists in <Link to="/channels" style={{ color: C.accent }}>Channels</Link>.</p>
          </div>
        ) : <ArtworkGrid artworks={feedArtworks} loading={loadingFeed} />
      )}

      {showEdit && (
        <EditProfileModal
          user={user}
          profile={profile}
          onClose={() => setShowEdit(false)}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  )
}

// ── Public Artist Profile (/u/:username) ──────────────────────
function ArtistProfilePage({ viewerUser }) {
  const { username } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [artworks, setArtworks] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [salesCount, setSalesCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [tab, setTab] = useState('artwork')

  useMeta({ title: `@${username}`, description: profile?.bio || `View ${username}'s artwork on Dreamscape` })

  useEffect(() => { loadProfile() }, [username])

  const loadProfile = async () => {
    setLoading(true)
    const { data: prof } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle()
    if (!prof) { setLoading(false); return }
    setProfile(prof)
    const [{ data: art }, { data: prods }, { count: followers }, { count: following }] = await Promise.all([
      supabase.from('artwork').select('*').eq('user_id', prof.id).order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('user_id', prof.id).order('created_at', { ascending: false }),
      supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', prof.id),
      supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', prof.id),
    ])
    setArtworks(art || [])
    setProducts(prods || [])
    setFollowerCount(followers || 0)
    setFollowingCount(following || 0)
    if (viewerUser) {
      const { data: f } = await supabase.from('follows').select('id').eq('follower_id', viewerUser.id).eq('following_id', prof.id).maybeSingle()
      setIsFollowing(!!f)
    }
    setLoading(false)
  }

  const toggleFollow = async () => {
    if (!viewerUser || followLoading || !profile) return
    setFollowLoading(true)
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', viewerUser.id).eq('following_id', profile.id)
      setIsFollowing(false); setFollowerCount(c => c - 1)
    } else {
      await supabase.from('follows').insert({ follower_id: viewerUser.id, following_id: profile.id })
      setIsFollowing(true); setFollowerCount(c => c + 1)
    }
    setFollowLoading(false)
  }

  if (loading) return <div style={{ paddingTop: 100 }}><Spinner /></div>
  if (!profile) return (
    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
      <p style={{ color: C.muted, fontSize: 16 }}>Artist not found.</p>
      <button onClick={() => navigate('/')} style={{ marginTop: 16, background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 16px', color: C.muted, cursor: 'pointer' }}>← Home</button>
    </div>
  )

  const isOwnProfile = viewerUser?.id === profile.id
  const tabs = [
    ['artwork', `🎨 Artwork (${artworks.length})`],
    ['shop', `🛍 Shop (${products.length})`],
    ['about', '✦ About'],
  ]

  return (
    <div style={{ padding: '32px 16px', maxWidth: 960, margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 12, cursor: 'pointer', marginBottom: 20 }}>← Back</button>
      <ProfileHeader
        profile={profile}
        artworkCount={artworks.length}
        followerCount={followerCount}
        followingCount={followingCount}
        salesCount={salesCount}
        isOwnProfile={isOwnProfile}
        viewerUser={viewerUser}
        onEdit={null}
        onFollow={toggleFollow}
        followLoading={followLoading}
        isFollowing={isFollowing}
      />

      <div style={{ height: 28 }} />
      <ProfileTabs tab={tab} setTab={setTab} tabs={tabs} />

      {tab === 'artwork' && <ArtworkGrid artworks={artworks} loading={false} />}

      {tab === 'shop' && (
        products.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛍</div>
            <p style={{ color: C.muted, fontSize: 14 }}>This artist hasn't listed any products yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {products.map(p => <ShopCard key={p.id} product={p} />)}
          </div>
        )
      )}

      {tab === 'about' && (
        <div style={{ maxWidth: 640 }}>
          {profile?.artist_statement && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 32px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Artist Statement</div>
              <p style={{ color: C.text, fontSize: 15, lineHeight: 1.8 }}>{profile.artist_statement}</p>
            </div>
          )}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Details</div>
            {[
              ['Username', `@${profile?.username}`],
              ['Display Name', profile?.display_name],
              ['Location', profile?.location],
              ['Website', profile?.website],
              ['Member Since', profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 14 }}>
                <span style={{ color: C.muted, minWidth: 110 }}>{label}</span>
                <span style={{ color: C.text }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


// ── Reset Password Page (/reset-password) ────────────────────
function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleReset = async () => {
    if (!password) return setError('Please enter a new password.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else setDone(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '40px 36px', maxWidth: 420, width: '100%', textAlign: 'center' }}>
        {done ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, marginBottom: 12 }}>Password updated!</h2>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>Your password has been changed successfully.</p>
            <button onClick={() => navigate('/')} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '12px 28px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Go to Dreamscape ✦</button>
          </>
        ) : (
          <>
            <div style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 16px', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>🔑</div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, marginBottom: 8 }}>Set New Password</h2>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>Choose a strong password for your account.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, textAlign: 'left' }}>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="New password"
                style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 14px', color: C.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Confirm new password" onKeyDown={e => e.key === 'Enter' && handleReset()}
                style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 14px', color: C.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            </div>
            {error && <div style={{ fontSize: 12, color: '#FF5E5E', marginBottom: 14, padding: '10px 12px', background: '#FF5E5E18', borderRadius: 8 }}>{error}</div>}
            <button onClick={handleReset} disabled={loading}
              style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: loading ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Updating...' : 'Update Password ✦'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
function DiscoverPage({ user, onSignIn }) {
  useMeta({ title: null, description: 'Generate AI art, connect with artists worldwide, and sell merchandise globally on Dreamscape.' })
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}18 0%, transparent 70%)`, top: '5%', left: '15%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: `radial-gradient(circle, ${C.teal}12 0%, transparent 70%)`, bottom: '10%', right: '10%', pointerEvents: 'none' }} />
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}>AI-Powered Artist Platform</div>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(36px, 7vw, 80px)', fontWeight: 900, lineHeight: 1.05, marginBottom: 20, maxWidth: 800 }}>
        Where Artists<br />
        <span style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.teal}, #FF6B9D, ${C.gold}, ${C.accent})`, backgroundSize: '300% 300%', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', animation: 'gradientShift 6s ease infinite', display: 'inline-block' }}>Create & Thrive</span>
      </h1>
      <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: C.muted, maxWidth: 500, lineHeight: 1.7, marginBottom: 36 }}>
        Generate stunning artwork with AI, connect with artists worldwide, and sell merchandise globally.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => user ? navigate('/create') : onSignIn()} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 12, padding: '13px 28px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Start Creating Free ✦</button>
        <button onClick={() => navigate('/marketplace')} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: '13px 28px', color: C.text, fontSize: 14, cursor: 'pointer' }}>Explore Marketplace</button>
      </div>
      <div style={{ display: 'flex', gap: 40, marginTop: 56, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[['10K+', 'Artists'], ['50K+', 'Artworks'], ['120+', 'Channels'], ['150+', 'Countries']].map(([num, label]) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.text, fontFamily: 'Playfair Display, serif' }}>{num}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Create Page (/create) ─────────────────────────────────────
function CreatePage({ user, onSignIn }) {
  useMeta({ title: 'Create with Dream AI', description: 'Generate AI art with Dream AI — describe your vision and create stunning artwork.' })
  return (
    <div style={{ padding: '40px 20px', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px, 5vw, 36px)', marginBottom: 10, color: C.text }}>Create with Dream AI</h1>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>Describe your vision and Dream will craft the perfect prompt — then generate an image and sell it globally.</p>
      </div>
      <DreamChat user={user} onSignIn={onSignIn} />
    </div>
  )
}

// ── Navbar ────────────────────────────────────────────────────
function Navbar({ user, profile, signOut, onSignIn }) {
  const location = useLocation()
  const [mobileMenu, setMobileMenu] = useState(false)
  const nav = location.pathname
  const navItems = [['/', 'Discover'], ['/channels', 'Channels'], ['/gallery', 'Gallery'], ['/marketplace', 'Marketplace'], ['/create', 'Create'], ['/blog', 'Blog'], ['/pricing', 'Pricing']]
  const isActive = (path) => path === '/' ? nav === '/' : nav.startsWith(path)

  return (
    <>
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(8,11,20,0.9)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.border}`, height: 60, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 24 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}
          onMouseDown={e => e.currentTarget.querySelector('.logo-icon').style.background = `linear-gradient(135deg, ${C.gold}, #E6A800)`}
          onMouseUp={e => e.currentTarget.querySelector('.logo-icon').style.background = `linear-gradient(135deg, ${C.accent}, #4B2FD0)`}
          onMouseLeave={e => e.currentTarget.querySelector('.logo-icon').style.background = `linear-gradient(135deg, ${C.accent}, #4B2FD0)`}>
          <div className="logo-icon" style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#ffffff', transition: 'background 0.2s' }}>✦</div>
          <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: 17 }}>
            <span style={{ color: '#E8EAF0' }}>Dream</span><span style={{ color: C.accent }}>scape</span>
          </span>
        </Link>
        <div className="nav-links" style={{ display: 'flex', gap: 2, flex: 1 }}>
          {navItems.map(([path, label]) => (
            <Link key={path} to={path} style={{ background: isActive(path) ? `${C.accent}20` : 'none', border: `1px solid ${isActive(path) ? C.accent + '55' : 'transparent'}`, borderRadius: 8, padding: '5px 12px', color: isActive(path) ? C.accent : C.muted, fontSize: 13, fontWeight: 500, textDecoration: 'none', transition: 'all 0.15s' }}>{label}</Link>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {user ? (
            <>
              <Link to="/profile" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', background: nav === '/profile' ? `${C.accent}20` : 'none', border: `1px solid ${nav === '/profile' ? C.accent + '55' : 'transparent'}`, borderRadius: 20, padding: '3px 10px 3px 3px' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: profile?.avatar_url ? '#0E1220' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                </div>
              </Link>
              <Link to="/orders" style={{ background: nav === '/orders' ? `${C.accent}20` : 'none', border: `1px solid ${nav === '/orders' ? C.accent + '55' : 'transparent'}`, borderRadius: 8, padding: '5px 12px', color: nav === '/orders' ? C.accent : C.muted, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>📦 Orders</Link>
              {profile?.is_admin && (
                <Link to="/admin" style={{ background: nav === '/admin' ? `${C.gold}20` : `${C.gold}10`, border: `1px solid ${C.gold}44`, borderRadius: 8, padding: '5px 12px', color: C.gold, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>⚡ Admin</Link>
              )}
              <button onClick={signOut} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Sign Out</button>
            </>
          ) : (
            <>
              <button onClick={onSignIn} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Sign In</button>
              <button onClick={onSignIn} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Join Free</button>
            </>
          )}
        </div>
        <button className="mobile-menu-btn" onClick={() => setMobileMenu(!mobileMenu)} style={{ display: 'none', background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', color: C.muted, cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>☰</button>
      </nav>
      {mobileMenu && (
        <div style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 99, background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map(([path, label]) => (
            <Link key={path} to={path} onClick={() => setMobileMenu(false)} style={{ background: isActive(path) ? `${C.accent}20` : 'none', borderRadius: 8, padding: '10px 14px', color: isActive(path) ? C.accent : C.text, fontSize: 14, textDecoration: 'none' }}>{label}</Link>
          ))}
          {user && <Link to="/orders" onClick={() => setMobileMenu(false)} style={{ background: isActive('/orders') ? `${C.accent}20` : 'none', borderRadius: 8, padding: '10px 14px', color: isActive('/orders') ? C.accent : C.text, fontSize: 14, textDecoration: 'none' }}>📦 Orders</Link>}
        </div>
      )}
    </>
  )
}

// ── Success Page (/success) ───────────────────────────────────
function SuccessPage() {
  useMeta({ title: 'Order Confirmed', description: 'Your order has been placed and is being fulfilled.' })
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    // Claim the order by linking session_id to logged-in user
    const sessionId = new URLSearchParams(window.location.search).get('session_id')
    if (sessionId && user) {
      supabase.from('orders')
        .update({ user_id: user.id })
        .eq('stripe_session_id', sessionId)
        .is('user_id', null)
        .then(() => {})
    }
  }, [user])
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: C.card, border: `1px solid ${C.teal}55`, borderRadius: 24, padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${C.teal}20`, border: `2px solid ${C.teal}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 24px' }}>✅</div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: C.text, marginBottom: 12 }}>Order Confirmed!</h1>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
          Your payment was successful and your order is now being processed by Printful.
        </p>
        <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7, marginBottom: 32 }}>
          You'll receive a shipping confirmation email once your item is on its way. Production typically takes 2–5 business days.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/marketplace')} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '11px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Back to Shop</button>
          <button onClick={() => navigate('/orders')} style={{ background: 'none', border: `1px solid ${C.accent}55`, borderRadius: 10, padding: '11px 24px', color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📦 View Orders</button>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 24px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Go Home</button>
        </div>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  usePageTracking()
  const { user, profile, setProfile, signOut, loading } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const needsProfileSetup = user && !profile?.username

  if (loading) return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: C.accent, fontSize: 32 }}>✦</div>
    </div>
  )

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'DM Sans', sans-serif", position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@700;900&display=swap');
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080B14; }
        @media (max-width: 640px) {
          .nav-links { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>

      <StarField />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Navbar user={user} profile={profile} signOut={signOut} onSignIn={() => setShowAuth(true)} />
        <div style={{ paddingTop: 60 }}>
          <Routes>
            <Route path="/" element={<DiscoverPage user={user} onSignIn={() => setShowAuth(true)} />} />
            <Route path="/channels" element={<Channels user={user} onSignIn={() => setShowAuth(true)} />} />
            <Route path="/channels/:channelName" element={<Channels user={user} onSignIn={() => setShowAuth(true)} />} />
            <Route path="/gallery" element={<Gallery user={user} onSignIn={() => setShowAuth(true)} />} />
            <Route path="/marketplace" element={<Marketplace user={user} onSignIn={() => setShowAuth(true)} />} />
            <Route path="/create" element={<CreatePage user={user} onSignIn={() => setShowAuth(true)} />} />
            <Route path="/profile" element={user ? <ProfilePage user={user} profile={profile} /> : <DiscoverPage user={user} onSignIn={() => setShowAuth(true)} />} />
            <Route path="/u/:username" element={<ArtistProfilePage viewerUser={user} />} />
            <Route path="/pricing" element={<Pricing user={user} onSignIn={() => setShowAuth(true)} />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/sitemap" element={<Sitemap />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/admin" element={<Admin user={user} profile={profile} />} />
            <Route path="/orders" element={<OrderHistory user={user} onSignIn={() => setShowAuth(true)} />} />
            <Route path="/success" element={<SuccessPage />} />
            <Route path="*" element={<DiscoverPage user={user} onSignIn={() => setShowAuth(true)} />} />
          </Routes>
        </div>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        {needsProfileSetup && <ProfileSetup user={user} onComplete={(p) => setProfile(prev => ({ ...prev, ...p }))} />}
        {/* Footer */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '20px', textAlign: 'center', marginTop: 40 }}>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', fontSize: 12, color: C.muted }}>
            <Link to="/blog" style={{ color: C.muted, textDecoration: 'none' }}>Blog</Link>
            <Link to="/privacy" style={{ color: C.muted, textDecoration: 'none' }}>Privacy Policy</Link>
            <Link to="/sitemap" style={{ color: C.muted, textDecoration: 'none' }}>Sitemap</Link>
            <Link to="/pricing" style={{ color: C.muted, textDecoration: 'none' }}>Pricing</Link>
            <a href="mailto:support@trydreamscape.com" style={{ color: C.muted, textDecoration: 'none' }}>Support</a>
            <a href="mailto:hello@trydreamscape.com" style={{ color: C.muted, textDecoration: 'none' }}>Contact</a>
            <span>© {new Date().getFullYear()} Dreamscape. All rights reserved.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
