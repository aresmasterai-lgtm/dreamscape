import { useState, useEffect } from 'react'
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { supabase } from './lib/supabase'
import AuthModal from './components/AuthModal'
import ProfileSetup from './components/ProfileSetup'
import Marketplace from './components/Marketplace'
import Channels from './components/Channels'
import Gallery from './components/Gallery'
import CreateProductModal from './components/CreateProductModal'

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

// ── Spinner ───────────────────────────────────────────────────
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

  useEffect(() => { bottomEl?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const history = [...messages.filter((_, i) => i > 0), userMsg]
    setMessages(prev => [...prev, userMsg])
    setInput(''); setLoading(true)
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
    try {
      const res = await fetch('/api/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, resolution: '1K' }) })
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
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: msg.role === 'user' ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : C.panel, border: msg.role === 'user' ? 'none' : `1px solid ${C.border}`, fontSize: 13, lineHeight: 1.6, color: C.text, whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </div>
            </div>
          ))}
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
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Describe your vision or ask Dream anything..."
            style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={send} disabled={loading || !input.trim()} style={{ background: loading || !input.trim() ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer' }}>✦</button>
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
      )}}
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

// ── Own Profile Page (/profile) ───────────────────────────────
function ProfilePage({ user, profile }) {
  useMeta({ title: `@${profile?.username || 'Profile'}`, description: profile?.bio })
  const [artworks, setArtworks] = useState([])
  const [loadingArt, setLoadingArt] = useState(true)
  const [feedArtworks, setFeedArtworks] = useState([])
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [tab, setTab] = useState('artworks')

  useEffect(() => {
    if (!user) return
    supabase.from('artwork').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setArtworks(data || []); setLoadingArt(false) })
    supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', user.id)
      .then(({ count }) => setFollowerCount(count || 0))
    supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', user.id)
      .then(({ count }) => setFollowingCount(count || 0))
    loadFeed()
  }, [user])

  const loadFeed = async () => {
    setLoadingFeed(true)
    const { data: followRows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id)
    if (!followRows?.length) { setFeedArtworks([]); setLoadingFeed(false); return }
    const ids = followRows.map(r => r.following_id)
    const { data } = await supabase.from('artwork').select('*, profiles(username)').in('user_id', ids).order('created_at', { ascending: false }).limit(40)
    setFeedArtworks(data || [])
    setLoadingFeed(false)
  }

  const avatarLetter = profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()
  const tabs = [['artworks', `Artworks (${loadingArt ? '…' : artworks.length})`], ['feed', 'Following Feed']]

  return (
    <div style={{ padding: '40px 16px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '28px 24px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{avatarLetter}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, marginBottom: 4 }}>@{profile?.username || user.email?.split('@')[0]}</h1>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{profile?.bio || 'No bio yet.'}</p>
          <div style={{ display: 'flex', gap: 24 }}>
            {[[loadingArt ? '—' : artworks.length, 'Artworks'], [followerCount, 'Followers'], [followingCount, 'Following']].map(([count, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{count}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === id ? C.accent : 'transparent'}`, padding: '8px 16px', color: tab === id ? C.accent : C.muted, fontSize: 13, fontWeight: tab === id ? 700 : 400, cursor: 'pointer', marginBottom: -1 }}>{label}</button>
        ))}
      </div>
      {tab === 'artworks' && <ArtworkGrid artworks={artworks} loading={loadingArt} />}
      {tab === 'feed' && (
        followingCount === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>You're not following anyone yet. Find artists in <Link to="/channels" style={{ color: C.accent }}>Channels</Link>.</p>
          </div>
        ) : <ArtworkGrid artworks={feedArtworks} loading={loadingFeed} />
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
  const [loading, setLoading] = useState(true)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  useMeta({ title: `@${username}`, description: profile?.bio || `View ${username}'s artwork on Dreamscape` })

  useEffect(() => { loadProfile() }, [username])

  const loadProfile = async () => {
    setLoading(true)
    const { data: prof } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle()
    if (!prof) { setLoading(false); return }
    setProfile(prof)
    const [{ data: art }, { count: followers }, { count: following }] = await Promise.all([
      supabase.from('artwork').select('*').eq('user_id', prof.id).order('created_at', { ascending: false }),
      supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', prof.id),
      supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', prof.id),
    ])
    setArtworks(art || [])
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
  const avatarLetter = profile.username?.[0]?.toUpperCase() || '?'

  return (
    <div style={{ padding: '40px 16px', maxWidth: 900, margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 12, cursor: 'pointer', marginBottom: 24 }}>← Back</button>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '28px 24px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{avatarLetter}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, marginBottom: 4 }}>@{profile.username}</h1>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{profile.bio || 'No bio yet.'}</p>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            {[[artworks.length, 'Artworks'], [followerCount, 'Followers'], [followingCount, 'Following']].map(([count, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{count}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
              </div>
            ))}
            {!isOwnProfile && viewerUser && (
              <button onClick={toggleFollow} disabled={followLoading} style={{ marginLeft: 'auto', background: isFollowing ? 'none' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: `1px solid ${isFollowing ? C.border : 'transparent'}`, borderRadius: 10, padding: '8px 20px', color: isFollowing ? C.muted : '#fff', fontSize: 13, fontWeight: 600, cursor: followLoading ? 'not-allowed' : 'pointer' }}>
                {followLoading ? '...' : isFollowing ? 'Following ✓' : '+ Follow'}
              </button>
            )}
          </div>
        </div>
      </div>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>Artworks</h2>
      <ArtworkGrid artworks={artworks} loading={false} />
    </div>
  )
}

// ── Discover Page (/) ─────────────────────────────────────────
function DiscoverPage({ user, onSignIn }) {
  useMeta({ title: null, description: 'Generate AI art, connect with artists worldwide, and sell merchandise globally on Dreamscape.' })
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}18 0%, transparent 70%)`, top: '5%', left: '15%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: `radial-gradient(circle, ${C.teal}12 0%, transparent 70%)`, bottom: '10%', right: '10%', pointerEvents: 'none' }} />
      <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}>AI-Powered Artist Platform</div>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(36px, 7vw, 80px)', fontWeight: 900, lineHeight: 1.05, marginBottom: 20, maxWidth: 800 }}>
        Where Artists<br />
        <span style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.teal})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Create & Thrive</span>
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
  const navItems = [['/', 'Discover'], ['/channels', 'Channels'], ['/gallery', 'Gallery'], ['/marketplace', 'Marketplace'], ['/create', 'Create']]
  const isActive = (path) => path === '/' ? nav === '/' : nav.startsWith(path)

  return (
    <>
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(8,11,20,0.9)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.border}`, height: 60, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 24 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✦</div>
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
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                  {profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                </div>
              </Link>
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
        </div>
      )}
    </>
  )
}

// ── Success Page (/success) ───────────────────────────────────
function SuccessPage() {
  useMeta({ title: 'Order Confirmed', description: 'Your order has been placed and is being fulfilled.' })
  const navigate = useNavigate()
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
          <button onClick={() => navigate('/')} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 24px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Go Home</button>
        </div>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
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
            <Route path="/success" element={<SuccessPage />} />
            <Route path="*" element={<DiscoverPage user={user} onSignIn={() => setShowAuth(true)} />} />
          </Routes>
        </div>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        {needsProfileSetup && <ProfileSetup user={user} onComplete={(p) => setProfile(prev => ({ ...prev, ...p }))} />}
      </div>
    </div>
  )
}
