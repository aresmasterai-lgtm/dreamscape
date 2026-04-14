// src/components/LoggedInHome.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494', red: '#FF4D4D',
}

const FEED_TTL = 5 * 60 * 1000
let _feedCache = { data: null, userId: null, ts: 0 }

// ── Dream Now bubble ──────────────────────────────────────────────────────────
function DreamNow({ profile }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    if (!value.trim()) { inputRef.current?.focus(); return }
    sessionStorage.setItem('ds_pending_prompt', value.trim())
    navigate('/create')
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const name = profile?.display_name || profile?.username || 'artist'

  return (
    <div style={{ padding: 'clamp(32px,6vw,64px) clamp(16px,5vw,48px) 0', maxWidth: 760, margin: '0 auto', width: '100%' }}>
      <style>{`
        @keyframes gradientShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes bubbleGlow { 0%,100%{box-shadow:0 0 0 0 rgba(124,92,252,0),0 8px 40px rgba(124,92,252,0.2)} 50%{box-shadow:0 0 0 8px rgba(124,92,252,0.06),0 8px 56px rgba(124,92,252,0.38)} }
        .lih-bubble { animation: bubbleGlow 3.5s ease-in-out infinite; }
        .lih-bubble:focus-within { animation:none!important; border-color:rgba(124,92,252,0.4)!important; box-shadow:0 4px 32px rgba(124,92,252,0.25)!important; }
        .lih-btn { transition:all 0.18s ease; }
        .lih-btn:hover { filter:brightness(1.12); transform:scale(1.03); }
        .lih-quick:hover { border-color:rgba(124,92,252,0.5)!important; color:#E8EAF0!important; }
        .lih-chip:hover { border-color:rgba(124,92,252,0.45)!important; color:#E8EAF0!important; background:rgba(124,92,252,0.1)!important; }
        .lih-input:focus { outline:none!important; box-shadow:none!important; }
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(22px,4vw,36px)', fontWeight: 900, color: C.text, margin: '0 0 6px', lineHeight: 1.1 }}>
          {greeting},{' '}
          <span style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.teal})`, backgroundSize: '200% 200%', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'gradientShift 5s ease infinite' }}>{name}</span> ✦
        </h1>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>What will you dream into existence today?</p>
      </div>

      <div className="lih-bubble" style={{ background: C.panel, border: `1.5px solid rgba(124,92,252,0.28)`, borderRadius: 22, padding: '7px 7px 7px 20px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, width: '100%', boxSizing: 'border-box' }}>
        <span style={{ fontSize: 18, flexShrink: 0, opacity: 0.5, userSelect: 'none' }}>✦</span>
        <input
          ref={inputRef}
          className="lih-input"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Describe your vision and Dream AI will create it..."
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', boxShadow: 'none', color: C.text, fontSize: 'clamp(13px,1.8vw,15px)', fontFamily: "'DM Sans', sans-serif", padding: '13px 0', minWidth: 0, caretColor: C.accent }}
        />
        <button className="lih-btn" onClick={handleSubmit} style={{ background: value.trim() ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : `rgba(124,92,252,0.16)`, border: 'none', borderRadius: 16, padding: 'clamp(10px,2vw,13px) clamp(16px,3vw,24px)', color: value.trim() ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
          Dream Now ✦
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
        {['Neon cityscape','Fantasy portrait','Abstract cosmos','Dark fantasy','Vintage poster','Surreal landscape'].map(chip => (
          <button key={chip} className="lih-chip" onClick={() => { setValue(chip); inputRef.current?.focus() }}
            style={{ background: `rgba(124,92,252,0.07)`, border: `1px solid rgba(124,92,252,0.18)`, borderRadius: 20, padding: '5px 13px', color: C.muted, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s' }}>
            {chip}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 40 }}>
        {[['🖼 My Gallery', '/gallery'], ['🛍 Marketplace', '/marketplace'], ['💰 Sell Art', '/create']].map(([label, path]) => (
          <button key={path} className="lih-quick" onClick={() => navigate(path)}
            style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 18px', color: C.muted, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'DM Sans', sans-serif" }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Art card ──────────────────────────────────────────────────────────────────
function ArtCard({ art, onClick }) {
  const [imgError, setImgError] = useState(false)
  if (!art.image_url || imgError) return null
  return (
    <div onClick={() => onClick(art)} className="ds-card" style={{ cursor: 'pointer', overflow: 'hidden', borderRadius: 14 }}>
      <div style={{ paddingBottom: '100%', position: 'relative', background: C.card }}>
        <img src={art.image_url} alt={art.title || 'artwork'} onError={() => setImgError(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      {art.profiles && (
        <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, ${C.teal})`, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700 }}>
            {art.profiles.avatar_url
              ? <img src={art.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (art.profiles.username?.[0] || '?').toUpperCase()}
          </div>
          <span style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{art.profiles.username}</span>
        </div>
      )}
    </div>
  )
}

// ── Feed lightbox with actions ────────────────────────────────────────────────
function FeedLightbox({ art, user, onClose, onSellThis }) {
  const navigate = useNavigate()
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [checked, setChecked] = useState(false)

  const creatorId = art.profiles?.id
  const isOwn = user?.id === creatorId

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [onClose])

  // Check follow status
  useEffect(() => {
    if (!user || !creatorId || isOwn) return
    supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', creatorId).single()
      .then(({ data }) => { setFollowing(!!data); setChecked(true) })
  }, [user?.id, creatorId])

  const toggleFollow = async () => {
    if (!user || followLoading) return
    setFollowLoading(true)
    if (following) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', creatorId)
      setFollowing(false)
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: creatorId })
      setFollowing(true)
    }
    setFollowLoading(false)
  }

  const btnStyle = { background: 'none', border: `1px solid rgba(255,255,255,0.15)`, borderRadius: 10, padding: '10px 18px', color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(8px)' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(4,6,15,0.96)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
      <style>{`@keyframes lbIn{from{opacity:0;transform:scale(0.94)}to{opacity:1;transform:scale(1)}}`}</style>

      {/* Close */}
      <button onClick={onClose} style={{ position: 'fixed', top: 20, right: 20, zIndex: 900, background: `rgba(124,92,252,0.85)`, border: '2px solid rgba(124,92,252,0.8)', borderRadius: '50%', width: 44, height: 44, color: '#fff', cursor: 'pointer', fontSize: 20, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(124,92,252,0.5)' }}>✕</button>

      <div onClick={e => e.stopPropagation()} style={{ maxWidth: 860, width: '100%', animation: 'lbIn 0.18s ease' }}>
        {/* Image */}
        <img src={art.image_url} alt={art.title || 'artwork'}
          style={{ width: '100%', borderRadius: 16, boxShadow: `0 0 80px ${C.accent}44`, display: 'block', maxHeight: '65vh', objectFit: 'contain', background: C.panel }} />

        {/* Info + actions */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>

          {/* Creator info */}
          <div onClick={() => { navigate(`/u/${art.profiles?.username}`); onClose() }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, ${C.teal})`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>
              {art.profiles?.avatar_url
                ? <img src={art.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (art.profiles?.username?.[0] || '?').toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>@{art.profiles?.username || 'unknown'}</div>
              {art.title && <div style={{ fontSize: 12, color: C.muted }}>{art.title}</div>}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* View profile */}
            <button onClick={() => { navigate(`/u/${art.profiles?.username}`); onClose() }} style={btnStyle}>
              👤 View Profile
            </button>

            {/* Follow / Unfollow — only for other users */}
            {user && !isOwn && checked && (
              <button onClick={toggleFollow} disabled={followLoading}
                style={{ ...btnStyle, background: following ? `${C.accent}22` : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: following ? `1px solid ${C.accent}55` : 'none', color: following ? C.accent : '#fff' }}>
                {followLoading ? '...' : following ? 'Following ✓' : '+ Follow'}
              </button>
            )}

            {/* Sell this — only for own artwork */}
            {user && isOwn && (
              <button onClick={() => { onSellThis(art); onClose() }}
                style={{ ...btnStyle, background: `linear-gradient(135deg, ${C.teal}, #00A884)`, border: 'none', color: '#fff' }}>
                Sell This ✦
              </button>
            )}

            {/* Dream with this style */}
            <button onClick={() => { sessionStorage.setItem('ds_pending_prompt', `In the style of: ${art.title || 'this artwork'} — `); navigate('/create'); onClose() }}
              style={{ ...btnStyle, background: `${C.accent}18`, borderColor: `${C.accent}44`, color: C.accent }}>
              ✦ Dream Like This
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LoggedInHome({ user, profile }) {
  const navigate = useNavigate()
  const [feedTab, setFeedTab]         = useState('trending')
  const [followingArt, setFollowingArt] = useState([])
  const [trendingArt, setTrendingArt]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [lightbox, setLightbox]         = useState(null)
  const [sellTarget, setSellTarget]     = useState(null)

  useEffect(() => {
    const now = Date.now()
    if (_feedCache.data && _feedCache.userId === user.id && (now - _feedCache.ts) < FEED_TTL) {
      setFollowingArt(_feedCache.data.followingArt)
      setTrendingArt(_feedCache.data.trendingArt)
      setLoading(false)
      return
    }
    loadFeed()
  }, [user.id])

  const loadFeed = async () => {
    setLoading(true)
    try {
      const { data: followRows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id)
      const ids = (followRows || []).map(r => r.following_id)
      const [followRes, trendRes] = await Promise.all([
        ids.length > 0
          ? supabase.from('artwork').select('*, profiles!user_id(id, username, display_name, avatar_url)').in('user_id', ids).eq('is_public', true).or('broken_image.is.null,broken_image.eq.false').order('created_at', { ascending: false }).limit(48)
          : Promise.resolve({ data: [] }),
        supabase.from('artwork').select('*, profiles!user_id(id, username, display_name, avatar_url)').eq('is_public', true).or('broken_image.is.null,broken_image.eq.false').order('created_at', { ascending: false }).limit(48),
      ])
      setFollowingArt(followRes.data || [])
      setTrendingArt(trendRes.data || [])
      _feedCache = { data: { followingArt: followRes.data || [], trendingArt: trendRes.data || [] }, userId: user.id, ts: Date.now() }
    } catch (e) { console.error('Feed load error:', e.message) }
    setLoading(false)
  }

  const feed = feedTab === 'following' ? followingArt : trendingArt

  return (
    <div style={{ minHeight: '100vh' }}>
      <DreamNow profile={profile} />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 clamp(16px,5vw,48px) 60px' }}>
        {/* Feed header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 0, background: C.card, borderRadius: 10, padding: 3 }}>
            {[['trending','🔥 Trending'], ['following','✦ Following']].map(([tab, label]) => (
              <button key={tab} onClick={() => setFeedTab(tab)}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: feedTab === tab ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : 'transparent', color: feedTab === tab ? '#fff' : C.muted, fontSize: 12, fontWeight: 600, transition: 'all 0.18s', fontFamily: "'DM Sans', sans-serif" }}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => navigate('/gallery')} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>See all →</button>
        </div>

        {/* Feed grid */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '48px 0' }}>
            <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(124,92,252,0.15)', borderTopColor: '#7C5CFC', animation: 'ds-spin 0.7s linear infinite' }} />
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Loading feed...</p>
          </div>
        ) : feedTab === 'following' && followingArt.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✦</div>
            <div style={{ fontSize: 15, color: C.text, fontWeight: 600, marginBottom: 8 }}>No one to follow yet</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>Discover creators in the Trending tab.</div>
            <button onClick={() => setFeedTab('trending')} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 22px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Explore Trending</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {feed.filter(a => a.image_url).slice(0, 24).map(art => (
              <ArtCard key={art.id} art={art} onClick={setLightbox} />
            ))}
          </div>
        )}
      </div>

      {/* Feed lightbox */}
      {lightbox && (
        <FeedLightbox
          art={lightbox}
          user={user}
          onClose={() => setLightbox(null)}
          onSellThis={(art) => setSellTarget(art)}
        />
      )}
    </div>
  )
}
