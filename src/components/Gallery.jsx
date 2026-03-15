import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CreateProductModal from './CreateProductModal'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494', red: '#FF4D4D',
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

// ── Art Card ──────────────────────────────────────────────────
function ArtCard({ art, isOwn, onSelect, onSell, onUseAgain, onDelete }) {
  const [hover, setHover] = useState(false)
  const navigate = useNavigate()

  return (
    <div
      style={{ breakInside: 'avoid', marginBottom: 14, borderRadius: 14, overflow: 'hidden', border: `1px solid ${hover ? C.accent + '88' : C.border}`, background: C.card, cursor: 'pointer', transition: 'all 0.2s', position: 'relative', transform: hover ? 'translateY(-2px)' : 'none' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}>

      {/* Image */}
      <div style={{ position: 'relative' }} onClick={() => onSelect(art)}>
        {art.image_url
          ? <img src={art.image_url} alt={art.title} style={{ width: '100%', display: 'block' }} loading="lazy" />
          : <div style={{ height: 160, background: `linear-gradient(135deg, ${C.accent}20, ${C.teal}15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🎨</div>
        }

        {/* Owner action overlay — appears on hover */}
        {isOwn && hover && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,11,20,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, backdropFilter: 'blur(2px)' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => onSell(art)}
              style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 22px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: 160 }}>
              🛍 Sell This
            </button>
            <button onClick={() => onUseAgain(art)}
              style={{ background: `${C.teal}22`, border: `1px solid ${C.teal}55`, borderRadius: 10, padding: '10px 22px', color: C.teal, fontSize: 13, fontWeight: 700, cursor: 'pointer', width: 160 }}>
              ↻ Use Again
            </button>
            <button onClick={() => onDelete(art)}
              style={{ background: 'none', border: `1px solid ${C.red}44`, borderRadius: 10, padding: '7px 22px', color: C.red, fontSize: 12, cursor: 'pointer', width: 160 }}>
              🗑 Delete
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{art.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); if (art.profiles?.username) navigate(`/u/${art.profiles.username}`) }}>
            @{art.profiles?.username || 'artist'}
          </div>
          {isOwn && (
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={e => { e.stopPropagation(); onSell(art) }}
                style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}33`, borderRadius: 6, padding: '3px 8px', color: C.accent, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                🛍
              </button>
              <button onClick={e => { e.stopPropagation(); onUseAgain(art) }}
                style={{ background: `${C.teal}18`, border: `1px solid ${C.teal}33`, borderRadius: 6, padding: '3px 8px', color: C.teal, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                ↻
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Use Again Modal ───────────────────────────────────────────
function UseAgainModal({ art, onClose, onSell }) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const copyPrompt = () => {
    navigator.clipboard.writeText(art.prompt || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(8,11,20,0.95)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, maxWidth: 540, width: '100%', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text }}>Reuse This Artwork</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Image preview */}
        <div style={{ background: C.bg, maxHeight: 260, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {art.image_url && <img src={art.image_url} alt={art.title} style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }} />}
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h4 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{art.title}</h4>

          {/* Prompt box */}
          {art.prompt && (
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.accent, textTransform: 'uppercase', letterSpacing: 1 }}>✦ Original Prompt</span>
                <button onClick={copyPrompt}
                  style={{ background: copied ? `${C.teal}20` : 'none', border: `1px solid ${copied ? C.teal + '55' : C.border}`, borderRadius: 6, padding: '3px 10px', color: copied ? C.teal : C.muted, fontSize: 11, cursor: 'pointer' }}>
                  {copied ? '✅ Copied!' : 'Copy'}
                </button>
              </div>
              <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, margin: 0 }}>{art.prompt}</p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
            <button onClick={() => { onSell(art); onClose() }}
              style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 12, padding: '13px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              🛍 Sell This
            </button>
            <button onClick={() => { navigate('/create', { state: { reusePrompt: art.prompt, reuseImage: art.image_url } }); onClose() }}
              style={{ background: `${C.teal}20`, border: `1px solid ${C.teal}44`, borderRadius: 12, padding: '13px', color: C.teal, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              ✦ Remix in Dream
            </button>
            <a href={art.image_url} download={`${art.title || 'dreamscape'}.png`} target="_blank" rel="noreferrer"
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: '13px', color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              ↓ Download
            </a>
            <button onClick={() => { navigator.clipboard.writeText(`https://trydreamscape.com`); }}
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: '13px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>
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
  const [selected, setSelected] = useState(null)
  const [createTarget, setCreateTarget] = useState(null)
  const [reuseTarget, setReuseTarget] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadArtworks() }, [tab, user])

  const loadArtworks = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('artwork')
        .select('*, profiles(id, username)')
        .order('created_at', { ascending: false })
        .limit(120)
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

  const handleDelete = async (art) => {
    setDeleting(true)
    await supabase.from('artwork').delete().eq('id', art.id)
    setArtworks(prev => prev.filter(a => a.id !== art.id))
    setDeleteConfirm(null)
    setDeleting(false)
  }

  const filtered = artworks.filter(a =>
    !search || a.title?.toLowerCase().includes(search.toLowerCase()) || a.prompt?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '40px 20px', maxWidth: 1200, margin: '0 auto' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, color: C.text, marginBottom: 8 }}>Gallery</h1>
        <p style={{ color: C.muted, fontSize: 14 }}>Every artwork is yours to reuse, sell, or remix — forever.</p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['all', '✦ All'], ['mine', '🎨 My Art']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ background: tab === id ? `${C.accent}20` : 'none', border: `1px solid ${tab === id ? C.accent + '55' : C.border}`, borderRadius: 8, padding: '8px 16px', color: tab === id ? C.accent : C.muted, fontSize: 13, fontWeight: tab === id ? 700 : 400, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search artwork..."
          style={{ flex: 1, minWidth: 160, maxWidth: 280, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 14px', color: C.text, fontSize: 13, outline: 'none' }} />
        <button onClick={() => navigate('/create')}
          style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '9px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>
          ✦ Create New
        </button>
      </div>

      {/* My Art tip */}
      {tab === 'mine' && user && !loading && artworks.length > 0 && (
        <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>💡</span>
          Hover any artwork to <strong style={{ color: C.accent }}>Sell This</strong>, <strong style={{ color: C.teal }}>Remix</strong>, or download — or use the quick buttons below each card.
        </div>
      )}

      {tab === 'mine' && !user ? (
        <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '32px', textAlign: 'center', marginBottom: 24 }}>
          <p style={{ color: C.text, marginBottom: 16, fontSize: 15 }}>Sign in to see your artwork library</p>
          <button onClick={onSignIn} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sign In</button>
        </div>
      ) : loading ? <Spinner /> : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🎨</div>
          <p style={{ color: C.muted, fontSize: 15, marginBottom: 20 }}>
            {tab === 'mine' ? "You haven't created any artwork yet." : search ? 'No artwork matches your search.' : 'No artwork yet — be the first to create!'}
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
              onSelect={setSelected}
              onSell={setCreateTarget}
              onUseAgain={setReuseTarget}
              onDelete={setDeleteConfirm}
            />
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button onClick={() => { setCreateTarget(selected); setSelected(null) }}
                    style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '11px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    🛍 Sell This
                  </button>
                  <button onClick={() => { setReuseTarget(selected); setSelected(null) }}
                    style={{ background: `${C.teal}20`, border: `1px solid ${C.teal}44`, borderRadius: 10, padding: '11px', color: C.teal, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    ↻ Use Again
                  </button>
                  <a href={selected.image_url} download={`${selected.title || 'dreamscape'}.png`} target="_blank" rel="noreferrer"
                    style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px', color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>
                    ↓ Download
                  </a>
                  <button onClick={() => { setDeleteConfirm(selected); setSelected(null) }}
                    style={{ background: `${C.red}12`, border: `1px solid ${C.red}33`, borderRadius: 10, padding: '11px', color: C.red, fontSize: 13, cursor: 'pointer' }}>
                    🗑 Delete
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

      {/* Use Again Modal */}
      {reuseTarget && (
        <UseAgainModal
          art={reuseTarget}
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
          onSuccess={() => { setCreateTarget(null); setSelected(null) }}
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
