// src/components/LoggedInHome.jsx
// ─────────────────────────────────────────────────────────────────────────────
// What logged-in users see at "/":
//   1. Dream Now bubble — front and center, full attention
//   2. Quick action row — Create, Marketplace, Gallery
//   3. Feed tabs (Following / Trending) — below the fold
// ─────────────────────────────────────────────────────────────────────────────
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

// ── Dream Now bubble (full-width, prominent) ──────────────────────────────────
function DreamNow({ profile }) {
  const navigate  = useNavigate()
  const inputRef  = useRef(null)
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
    <div style={{
      padding: 'clamp(32px, 6vw, 64px) clamp(16px, 5vw, 48px) 0',
      maxWidth: 760,
      margin: '0 auto',
      width: '100%',
    }}>
      <style>{`
        @keyframes gradientShift {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes bubbleGlow {
          0%,100% { box-shadow: 0 0 0 0 rgba(124,92,252,0), 0 8px 40px rgba(124,92,252,0.2); }
          50%      { box-shadow: 0 0 0 8px rgba(124,92,252,0.06), 0 8px 56px rgba(124,92,252,0.38); }
        }
        .lih-bubble { animation: bubbleGlow 3.5s ease-in-out infinite; }
        .lih-bubble:focus-within {
          animation: none !important;
          border-color: rgba(124,92,252,0.65) !important;
          box-shadow: 0 0 0 3px rgba(124,92,252,0.14), 0 8px 56px rgba(124,92,252,0.45) !important;
        }
        .lih-btn { transition: all 0.18s ease; }
        .lih-btn:hover  { filter: brightness(1.12); transform: scale(1.03); }
        .lih-btn:active { transform: scale(0.97); }
        .lih-quick:hover { border-color: rgba(124,92,252,0.5) !important; color: #E8EAF0 !important; }
        .lih-chip:hover  { border-color: rgba(124,92,252,0.45) !important; color: #E8EAF0 !important; background: rgba(124,92,252,0.1) !important; }
      `}</style>

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: 'clamp(22px, 4vw, 36px)',
          fontWeight: 900,
          color: C.text,
          margin: '0 0 6px',
          lineHeight: 1.1,
        }}>
          {greeting},{' '}
          <span style={{
            background: `linear-gradient(135deg, ${C.accent}, ${C.teal})`,
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'gradientShift 5s ease infinite',
          }}>{name}</span> ✦
        </h1>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>What will you dream into existence today?</p>
      </div>

      {/* THE BUBBLE */}
      <div className="lih-bubble" style={{
        background: C.panel,
        border: `1.5px solid rgba(124,92,252,0.28)`,
        borderRadius: 22,
        padding: '7px 7px 7px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14,
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <span style={{ fontSize: 18, flexShrink: 0, opacity: 0.5, userSelect: 'none' }}>✦</span>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Describe your vision and Dream AI will create it..."
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: C.text,
            fontSize: 'clamp(13px, 1.8vw, 15px)',
            fontFamily: "'DM Sans', sans-serif",
            padding: '13px 0',
            minWidth: 0,
            caretColor: C.accent,
          }}
        />
        <button
          className="lih-btn"
          onClick={handleSubmit}
          style={{
            background: value.trim()
              ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)`
              : `rgba(124,92,252,0.16)`,
            border: 'none',
            borderRadius: 16,
            padding: 'clamp(10px,2vw,13px) clamp(16px,3vw,24px)',
            color: value.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            letterSpacing: '0.2px',
          }}>
          Dream Now ✦
        </button>
      </div>

      {/* Quick inspiration chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
        {['Neon cityscape', 'Fantasy portrait', 'Abstract cosmos', 'Dark fantasy', 'Vintage poster', 'Surreal landscape'].map(chip => (
          <button
            key={chip}
            className="lih-chip"
            onClick={() => { setValue(chip); inputRef.current?.focus() }}
            style={{
              background: `rgba(124,92,252,0.07)`,
              border: `1px solid rgba(124,92,252,0.18)`,
              borderRadius: 20,
              padding: '5px 13px',
              color: C.muted,
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.15s',
            }}>
            {chip}
          </button>
        ))}
      </div>

      {/* Quick action row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 40 }}>
        {[
          { label: '🖼 My Gallery', path: '/gallery' },
          { label: '🛍 Marketplace', path: '/marketplace' },
          { label: '💰 Sell Art', path: '/create' },
        ].map(({ label, path }) => (
          <button
            key={path}
            className="lih-quick"
            onClick={() => navigate(path)}
            style={{
              background: 'none',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '9px 18px',
              color: C.muted,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: "'DM Sans', sans-serif",
            }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Art card in feed ──────────────────────────────────────────────────────────
function ArtCard({ art, onClick }) {
  const [imgError, setImgError] = useState(false)
  if (!art.image_url || imgError) return null
  return (
    <div
      onClick={() => onClick(art)}
      className="ds-card"
      style={{ cursor: 'pointer', overflow: 'hidden', borderRadius: 14 }}>
      <div style={{ paddingBottom: '100%', position: 'relative', background: C.card }}>
        <img
          src={art.image_url}
          alt={art.title || 'artwork'}
          onError={() => setImgError(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
      {art.profiles && (
        <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, ${C.teal})`, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700 }}>
            {art.profiles.avatar_url
              ? <img src={art.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (art.profiles.username?.[0] || '?').toUpperCase()}
          </div>
          <span style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            @{art.profiles.username}
          </span>
        </div>
      )}
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

  useEffect(() => {
    const now = Date.now()
    if (_feedCache.data && _feedCache.userId === user.id && (now - _feedCache.ts) < FEED_TTL) {
      const c = _feedCache.data
      setFollowingArt(c.followingArt)
      setTrendingArt(c.trendingArt)
      setLoading(false)
      return
    }
    loadFeed()
  }, [user.id])

  const loadFeed = async () => {
    setLoading(true)
    try {
      const { data: followRows } = await supabase
        .from('follows').select('following_id').eq('follower_id', user.id)
      const ids = (followRows || []).map(r => r.following_id)

      const [followRes, trendRes] = await Promise.all([
        ids.length > 0
          ? supabase.from('artwork')
              .select('*, profiles!user_id(id, username, display_name, avatar_url)')
              .in('user_id', ids).eq('is_public', true)
              .or('broken_image.is.null,broken_image.eq.false')
              .order('created_at', { ascending: false }).limit(48)
          : Promise.resolve({ data: [] }),
        supabase.from('artwork')
          .select('*, profiles!user_id(id, username, display_name, avatar_url)')
          .eq('is_public', true)
          .or('broken_image.is.null,broken_image.eq.false')
          .order('created_at', { ascending: false }).limit(48),
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

      {/* ── Dream Now section ── */}
      <DreamNow profile={profile} />

      {/* ── Feed section ── */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 clamp(16px, 5vw, 48px) 60px' }}>

        {/* Section header + tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 0, background: C.card, borderRadius: 10, padding: 3 }}>
            {[['trending', '🔥 Trending'], ['following', '✦ Following']].map(([tab, label]) => (
              <button key={tab} onClick={() => setFeedTab(tab)}
                style={{
                  padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: feedTab === tab ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : 'transparent',
                  color: feedTab === tab ? '#fff' : C.muted,
                  fontSize: 12, fontWeight: 600, transition: 'all 0.18s',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => navigate('/gallery')}
            style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
            See all →
          </button>
        </div>

        {/* Feed grid */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '48px 0' }}>
            <style>{`@keyframes cpulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'cpulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
            </div>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Loading feed...</p>
          </div>
        ) : feedTab === 'following' && followingArt.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✦</div>
            <div style={{ fontSize: 15, color: C.text, fontWeight: 600, marginBottom: 8 }}>No one to follow yet</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>Discover creators in the Trending tab and follow the ones you love.</div>
            <button onClick={() => setFeedTab('trending')}
              style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 22px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Explore Trending
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {feed.filter(a => a.image_url).slice(0, 24).map(art => (
              <ArtCard key={art.id} art={art} onClick={setLightbox} />
            ))}
          </div>
        )}
      </div>

      {/* Simple lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20, cursor: 'pointer' }}>
          <img src={lightbox.image_url} alt={lightbox.title}
            style={{ maxWidth: '90vw', maxHeight: '88vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 0 80px rgba(124,92,252,0.3)' }} />
          <button onClick={() => setLightbox(null)}
            style={{ position: 'fixed', top: 20, right: 20, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}
    </div>
  )
}
