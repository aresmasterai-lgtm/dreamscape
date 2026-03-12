import { useState, useRef, useEffect } from 'react'
import { useAuth } from './lib/auth'
import { supabase } from './lib/supabase'
import AuthModal from './components/AuthModal'
import ProfileSetup from './components/ProfileSetup'
import Marketplace from './components/Marketplace'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
}

// ── Save to Gallery Modal ─────────────────────────────────────
function SaveModal({ prompt, imageUrl, onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!title.trim()) return setError('Please give your artwork a title.')
    setError('')
    setSaving(true)
    const styleTags = tags.split(',').map(t => t.trim()).filter(Boolean)
    await onSave({ title: title.trim(), prompt, styleTags, imageUrl })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(8,11,20,0.92)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '32px 36px', maxWidth: 480, width: '100%' }}>
        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 4 }}>Save to Gallery</h3>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>This prompt will be saved to your artwork gallery.</p>

        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 12, color: C.muted, lineHeight: 1.6, maxHeight: 80, overflow: 'hidden' }}>
          {prompt.slice(0, 200)}{prompt.length > 200 ? '...' : ''}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Title</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="e.g. Cosmic Dreamscape #1"
            style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Style Tags <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional, comma separated)</span></label>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="e.g. surrealism, dark, neon"
            style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        {error && (
          <div style={{ background: '#ff6b6b18', border: '1px solid #ff6b6b44', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ff6b6b' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: saving ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '11px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
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
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const history = [...messages.filter((m, i) => i > 0), userMsg]
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/dream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Something went wrong. Try again.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async ({ title, prompt, styleTags, imageUrl }) => {
    const { error } = await supabase.from('artwork').insert({
      user_id: user.id,
      title,
      prompt,
      image_url: imageUrl || '',
      style_tags: styleTags,
    })
    if (!error) {
      setSavedIndexes(prev => new Set([...prev, saveTarget.index]))
      setSaveTarget(null)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  const generateImage = async (prompt, index) => {
    setGeneratingIndex(index)
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, resolution: '1K' }),
      })
      const data = await res.json()
      if (data.success) {
        const dataUrl = `data:${data.mimeType};base64,${data.imageData}`
        setGeneratedImages(prev => ({ ...prev, [index]: dataUrl }))
      } else {
        alert('Image generation failed: ' + (data.error || 'Unknown error'))
      }
    } catch {
      alert('Connection error generating image.')
    } finally {
      setGeneratingIndex(null)
    }
  }

  // Find last assistant message index (excluding welcome)
  const lastAssistantIndex = messages.reduce((last, msg, i) => msg.role === 'assistant' && i > 0 ? i : last, -1)

  if (!user) {
    return (
      <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✦</div>
        <p style={{ color: C.text, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>Meet Dream AI</p>
        <p style={{ color: C.muted, marginBottom: 24, fontSize: 14 }}>Your creative companion for AI art generation</p>
        <button onClick={onSignIn} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '12px 28px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Sign In to Create ✦</button>
      </div>
    )
  }

  return (
    <>
      {saveSuccess && (
        <div style={{ background: `${C.teal}18`, border: `1px solid ${C.teal}55`, borderRadius: 10, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: C.teal }}>
          ✅ Saved to your gallery! View it on your profile.
        </div>
      )}

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 520 }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✦</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Dream AI</div>
            <div style={{ fontSize: 11, color: C.teal }}>● online</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: msg.role === 'user' ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : C.panel,
                border: msg.role === 'user' ? 'none' : `1px solid ${C.border}`,
                fontSize: 13, lineHeight: 1.6, color: C.text, whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px 12px 12px 4px', padding: '10px 16px', display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Action bar — always visible when Dream has responded */}
        {lastAssistantIndex >= 0 && !loading && (
          <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, background: C.panel, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
            {generatedImages[lastAssistantIndex] ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, flexWrap: 'wrap' }}>
                <img src={generatedImages[lastAssistantIndex]} alt="Generated" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}` }} />
                <span style={{ fontSize: 12, color: C.teal }}>✅ Image ready!</span>
                <button
                  onClick={() => !savedIndexes.has(lastAssistantIndex) && setSaveTarget({ prompt: messages[lastAssistantIndex].content, index: lastAssistantIndex, imageUrl: generatedImages[lastAssistantIndex] })}
                  style={{
                    background: savedIndexes.has(lastAssistantIndex) ? 'none' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`,
                    border: `1px solid ${savedIndexes.has(lastAssistantIndex) ? C.teal + '55' : 'transparent'}`,
                    borderRadius: 8, padding: '6px 14px',
                    color: savedIndexes.has(lastAssistantIndex) ? C.teal : '#fff',
                    fontSize: 12, fontWeight: 600, cursor: savedIndexes.has(lastAssistantIndex) ? 'default' : 'pointer',
                  }}
                >
                  {savedIndexes.has(lastAssistantIndex) ? '✅ Saved to Gallery' : '✦ Save to Gallery'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>Happy with this prompt?</span>
                <button
                  onClick={() => generatingIndex === null && generateImage(messages[lastAssistantIndex].content, lastAssistantIndex)}
                  disabled={generatingIndex !== null}
                  style={{
                    background: generatingIndex !== null ? C.border : `${C.teal}20`,
                    border: `1px solid ${generatingIndex !== null ? C.border : C.teal + '66'}`,
                    borderRadius: 8, padding: '6px 14px',
                    color: generatingIndex !== null ? C.muted : C.teal,
                    fontSize: 12, fontWeight: 600, cursor: generatingIndex !== null ? 'not-allowed' : 'pointer',
                  }}
                >
                  {generatingIndex !== null ? '⏳ Generating...' : '🍌 Generate Image'}
                </button>
                <button
                  onClick={() => !savedIndexes.has(lastAssistantIndex) && setSaveTarget({ prompt: messages[lastAssistantIndex].content, index: lastAssistantIndex, imageUrl: '' })}
                  style={{
                    background: 'none',
                    border: `1px solid ${savedIndexes.has(lastAssistantIndex) ? C.teal + '55' : C.border}`,
                    borderRadius: 8, padding: '6px 14px',
                    color: savedIndexes.has(lastAssistantIndex) ? C.teal : C.muted,
                    fontSize: 12, cursor: savedIndexes.has(lastAssistantIndex) ? 'default' : 'pointer',
                  }}
                >
                  {savedIndexes.has(lastAssistantIndex) ? '✅ Saved' : '✦ Save Prompt'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Describe your vision or ask Dream anything..."
            style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={send} disabled={loading || !input.trim()} style={{
            background: loading || !input.trim() ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`,
            border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
          }}>✦</button>
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
      </div>

      {saveTarget && (
        <SaveModal
          prompt={saveTarget.prompt}
          imageUrl={saveTarget.imageUrl}
          onSave={handleSave}
          onClose={() => setSaveTarget(null)}
        />
      )}
    </>
  )
}

// ── Profile Page ──────────────────────────────────────────────
function ProfilePage({ user, profile }) {
  const [artworks, setArtworks] = useState([])
  const [loadingArt, setLoadingArt] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('artwork')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setArtworks(data || [])
        setLoadingArt(false)
      })
  }, [user])

  const avatarLetter = profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()

  return (
    <div style={{ padding: '40px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '32px 36px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {avatarLetter}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, color: C.text, marginBottom: 4 }}>
            @{profile?.username || user.email?.split('@')[0]}
          </h2>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
            {profile?.bio || 'No bio yet.'}
          </p>
          <div style={{ display: 'flex', gap: 20 }}>
            {[[loadingArt ? '—' : artworks.length, 'Artworks'], ['0', 'Followers'], ['0', 'Following']].map(([count, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{count}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>Artworks</h3>
        {loadingArt ? (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '40px 0' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        ) : artworks.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎨</div>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6 }}>
              No artworks yet. Head to <strong style={{ color: C.accent }}>Create</strong> and hit <strong style={{ color: C.accent }}>Save to Gallery</strong> on any Dream AI response.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {artworks.map(art => (
              <div
                key={art.id}
                onClick={() => setExpanded(expanded === art.id ? null : art.id)}
                style={{ background: C.card, border: `1px solid ${expanded === art.id ? C.accent + '88' : C.border}`, borderRadius: 16, padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '55'}
                onMouseLeave={e => e.currentTarget.style.borderColor = expanded === art.id ? C.accent + '88' : C.border}
              >
                <div style={{ height: 120, borderRadius: 10, background: `linear-gradient(135deg, ${C.accent}30, ${C.teal}20)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, fontSize: 36, overflow: 'hidden' }}>
                  {art.image_url
                    ? <img src={art.image_url} alt={art.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : '🎨'
                  }
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>{art.title}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, overflow: 'hidden', maxHeight: expanded === art.id ? '300px' : '40px', transition: 'max-height 0.3s' }}>
                  {art.prompt}
                </div>
                {art.style_tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {art.style_tags.map(tag => (
                      <span key={tag} style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11, color: C.accent }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>
                  {new Date(art.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const { user, profile, setProfile, signOut, loading } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [activeNav, setActiveNav] = useState('discover')

  const needsProfileSetup = user && !profile?.username

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.accent, fontSize: 32 }}>✦</div>
      </div>
    )
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@700;900&display=swap');`}</style>

      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(8,11,20,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`, height: 64,
        display: 'flex', alignItems: 'center', padding: '0 32px', gap: 32
      }}>
        <button onClick={() => setActiveNav('discover')} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✦</div>
          <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: 18 }}>
            <span style={{ color: C.text }}>Dream</span><span style={{ color: C.accent }}>scape</span>
          </span>
        </button>
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {[['discover', 'Discover'], ['channels', 'Channels'], ['marketplace', 'Marketplace'], ['create', 'Create']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveNav(id)} style={{
              background: activeNav === id ? `${C.accent}20` : 'none',
              border: `1px solid ${activeNav === id ? C.accent + '55' : 'transparent'}`,
              borderRadius: 8, padding: '6px 14px', color: activeNav === id ? C.accent : C.muted,
              fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s'
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user ? (
            <>
              <button onClick={() => setActiveNav('profile')} style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                background: activeNav === 'profile' ? `${C.accent}20` : 'none',
                border: `1px solid ${activeNav === 'profile' ? C.accent + '55' : 'transparent'}`,
                borderRadius: 20, padding: '4px 12px 4px 4px',
              }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                  {profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                  {profile?.username || user.email?.split('@')[0]}
                </span>
              </button>
              <button onClick={signOut} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Sign Out</button>
            </>
          ) : (
            <>
              <button onClick={() => setShowAuth(true)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Sign In</button>
              <button onClick={() => setShowAuth(true)} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '7px 16px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Join Free</button>
            </>
          )}
        </div>
      </nav>

      <div style={{ paddingTop: 64 }}>
        {activeNav === 'discover' && (
          <div>
            <div style={{ minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}18 0%, transparent 70%)`, top: '10%', left: '20%', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${C.teal}12 0%, transparent 70%)`, bottom: '10%', right: '15%', pointerEvents: 'none' }} />
              <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}>AI-Powered Artist Platform</div>
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(42px, 8vw, 88px)', fontWeight: 900, lineHeight: 1.05, marginBottom: 24, maxWidth: 800 }}>
                Where Artists<br />
                <span style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.teal})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Create & Thrive</span>
              </h1>
              <p style={{ fontSize: 18, color: C.muted, maxWidth: 520, lineHeight: 1.7, marginBottom: 40 }}>
                Generate stunning artwork with AI, connect with artists worldwide, and sell merchandise globally — all in one platform.
              </p>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => { setActiveNav('create'); if (!user) setShowAuth(true) }} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 12, padding: '14px 32px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Start Creating Free ✦</button>
                <button onClick={() => setActiveNav('marketplace')} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 32px', color: C.text, fontSize: 15, cursor: 'pointer' }}>Explore Marketplace</button>
              </div>
              <div style={{ display: 'flex', gap: 48, marginTop: 64, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[['10K+', 'Artists'], ['50K+', 'Artworks'], ['120+', 'Channels'], ['150+', 'Countries']].map(([num, label]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: C.text, fontFamily: 'Playfair Display, serif' }}>{num}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeNav === 'channels' && (
          <div style={{ padding: '40px 32px', maxWidth: 900, margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, marginBottom: 8 }}>Channels</h2>
            <p style={{ color: C.muted, marginBottom: 32 }}>Join conversations with artists around the world.</p>
            {!user && (
              <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '20px 24px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <span style={{ fontSize: 14, color: C.text }}>Sign in to post and join the conversation</span>
                <button onClick={() => setShowAuth(true)} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '8px 18px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sign In</button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {[['🎨', 'surrealism', 'Surrealism', '4.8K'], ['⚡', 'ai-generation', 'AI Generation', '9.1K'], ['🌍', 'afrofuturism', 'Afrofuturism', '6.5K'], ['🌊', 'vaporwave', 'Vaporwave', '2.9K'], ['🛒', 'product-drops', 'Product Drops', '8.3K'], ['🤝', 'collabs-wanted', 'Collabs Wanted', '2.2K']].map(([icon, id, name, members]) => (
                <div key={id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '55'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                  <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>#{name}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{members} members</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeNav === 'marketplace' && (
          <Marketplace user={user} onSignIn={() => setShowAuth(true)} />
        )}

        {activeNav === 'create' && (
          <div style={{ padding: '40px 32px', maxWidth: 700, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 36, marginBottom: 10 }}>Create with Dream AI</h2>
              <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.7 }}>Describe your vision and Dream will craft the perfect prompt — then apply it to 300+ products and sell globally.</p>
            </div>
            <DreamChat user={user} onSignIn={() => setShowAuth(true)} />
          </div>
        )}

        {activeNav === 'profile' && user && (
          <ProfilePage user={user} profile={profile} />
        )}
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {needsProfileSetup && (
        <ProfileSetup
          user={user}
          onComplete={(updatedProfile) => {
            setProfile(prev => ({ ...prev, ...updatedProfile }))
          }}
        />
      )}
    </div>
  )
}
