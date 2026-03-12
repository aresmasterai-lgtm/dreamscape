import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CreateProductModal from './CreateProductModal'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
}

function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
      </div>
    </div>
  )
}

export default function Gallery({ user, onSignIn }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const [artworks, setArtworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [createTarget, setCreateTarget] = useState(null)

  useEffect(() => { loadArtworks() }, [tab, user])

  const loadArtworks = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('artwork')
        .select('*, profiles(id, username)')
        .order('created_at', { ascending: false })
        .limit(80)
      if (tab === 'mine') {
        if (!user) { setArtworks([]); setLoading(false); return }
        query = query.eq('user_id', user.id)
      }
      const { data } = await query
      setArtworks(data || [])
    } catch {}
    setLoading(false)
  }

  const isOwn = (art) => user && art.user_id === user.id

  const handleDownload = (art) => {
    const a = document.createElement('a')
    a.href = art.image_url
    a.download = `${art.title || 'dreamscape'}.png`
    a.target = '_blank'
    a.click()
  }

  return (
    <div style={{ padding: '40px 20px', maxWidth: 1200, margin: '0 auto' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, color: C.text, marginBottom: 8 }}>Gallery</h1>
        <p style={{ color: C.muted, fontSize: 14 }}>Discover AI artwork from the Dreamscape community.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {[['all', '✦ All Artwork'], ['mine', '🎨 My Artwork']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ background: tab === id ? `${C.accent}20` : 'none', border: `1px solid ${tab === id ? C.accent + '55' : C.border}`, borderRadius: 8, padding: '8px 18px', color: tab === id ? C.accent : C.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'mine' && !user && (
        <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '32px', textAlign: 'center', marginBottom: 24 }}>
          <p style={{ color: C.text, marginBottom: 16, fontSize: 15 }}>Sign in to see your artwork</p>
          <button onClick={onSignIn} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sign In</button>
        </div>
      )}

      {loading ? <Spinner /> : artworks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🎨</div>
          <p style={{ color: C.muted, fontSize: 15, marginBottom: 20 }}>
            {tab === 'mine' ? "You haven't created any artwork yet." : 'No artwork yet — be the first to create!'}
          </p>
          <button onClick={() => navigate('/create')}
            style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '11px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Start Creating ✦
          </button>
        </div>
      ) : (
        <div style={{ columns: 'auto 260px', columnGap: 14 }}>
          {artworks.map(art => (
            <div key={art.id} onClick={() => setSelected(art)}
              style={{ breakInside: 'avoid', marginBottom: 14, borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}`, background: C.card, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent + '88'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)' }}>
              {art.image_url && <img src={art.image_url} alt={art.title} style={{ width: '100%', display: 'block' }} loading="lazy" />}
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{art.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 11, color: C.muted }}
                    onClick={e => { e.stopPropagation(); if (art.profiles?.username) navigate(`/u/${art.profiles.username}`) }}>
                    @{art.profiles?.username || 'artist'}
                  </div>
                  {isOwn(art) && <div style={{ fontSize: 10, background: `${C.accent}20`, color: C.accent, borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>YOURS</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Artwork Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(8,11,20,0.95)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, maxWidth: 580, width: '100%', overflow: 'hidden' }}>
            <div style={{ position: 'relative', background: C.bg }}>
              {selected.image_url && <img src={selected.image_url} alt={selected.title} style={{ width: '100%', maxHeight: 380, objectFit: 'contain', display: 'block' }} />}
              <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(8,11,20,0.8)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: C.text, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text, marginBottom: 4 }}>{selected.title}</h3>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, cursor: 'pointer' }}
                onClick={() => { navigate(`/u/${selected.profiles?.username}`); setSelected(null) }}>
                by @{selected.profiles?.username || 'artist'}
              </div>
              {selected.prompt && (
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                  "{selected.prompt.slice(0, 200)}{selected.prompt.length > 200 ? '...' : ''}"
                </div>
              )}
              {isOwn(selected) ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setCreateTarget(selected)}
                    style={{ flex: 1, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '11px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    🛍 Create Product
                  </button>
                  <button onClick={() => handleDownload(selected)}
                    style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 16px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>
                    ↓ Download
                  </button>
                </div>
              ) : (
                <button onClick={() => { navigate(`/u/${selected.profiles?.username}`); setSelected(null) }}
                  style={{ width: '100%', background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>
                  View Artist Profile →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Product Modal */}
      {createTarget && (
        <CreateProductModal
          user={user}
          imageUrl={createTarget.image_url}
          artworkId={createTarget.id}
          title={createTarget.title}
          onClose={() => setCreateTarget(null)}
          onSuccess={() => { setCreateTarget(null); setSelected(null) }}
        />
      )}
    </div>
  )
}
