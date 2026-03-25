import { useState, useEffect, useRef, useCallback, Component, lazy, Suspense } from 'react'
import { Routes, Route, Link, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { supabase } from './lib/supabase'

// ── Code-split routes — only loaded when visited ──────────────
const AuthModal         = lazy(() => import('./components/AuthModal'))
const ProfileSetup      = lazy(() => import('./components/ProfileSetup'))
const Marketplace       = lazy(() => import('./components/Marketplace'))
const Gallery           = lazy(() => import('./components/Gallery'))
const CreateProductModal = lazy(() => import('./components/CreateProductModal'))
const OrderHistory      = lazy(() => import('./components/OrderHistory'))
const Pricing           = lazy(() => import('./components/Pricing'))
const Admin             = lazy(() => import('./components/Admin'))
const Privacy           = lazy(() => import('./components/Privacy'))
const Sitemap           = lazy(() => import('./components/Sitemap'))
const Blog              = lazy(() => import('./components/Blog'))
const Terms             = lazy(() => import('./components/Terms'))
const Contact           = lazy(() => import('./components/Contact'))
const BlogPost          = lazy(() => import('./components/BlogPost'))
const Channels          = lazy(() => import('./components/Channels'))

// ── Auth header helper ────────────────────────────────────────
// Attaches the user's JWT to every API call so Netlify functions
// can verify the request is from a real authenticated user.
async function getAuthHeader() {
  try {
    // refreshSession keeps the token fresh — prevents "Invalid or expired session" errors
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return {}
    // If token expires within 60 seconds, refresh proactively
    const expiresAt = session.expires_at || 0
    const nowSecs   = Math.floor(Date.now() / 1000)
    if (expiresAt - nowSecs < 60) {
      const { data: refreshed } = await supabase.auth.refreshSession()
      if (refreshed?.session?.access_token) {
        return { 'Authorization': `Bearer ${refreshed.session.access_token}` }
      }
    }
    if (session?.access_token) {
      return { 'Authorization': `Bearer ${session.access_token}` }
    }
  } catch {}
  return {}
}




// ── Error Boundary ────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info)
    // Fire event so FloatingFeedback can auto-open with pre-filled context
    window.dispatchEvent(new CustomEvent('dreamscape:error', {
      detail: { message: error?.message, page: window.location.pathname }
    }))
  }
  componentDidUpdate(prevProps) {
    // Reset error when route changes
    if (prevProps.routeKey !== this.props.routeKey) {
      this.setState({ hasError: false, error: null })
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '80px 20px', textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: '#E8EAF0', marginBottom: 12 }}>Something went wrong</h2>
          <p style={{ color: '#6B7494', fontSize: 14, marginBottom: 8, maxWidth: 400 }}>
            {this.state.error?.message || 'This page ran into an error.'}
          </p>
          <p style={{ color: '#6B7494', fontSize: 13, marginBottom: 24, maxWidth: 400 }}>
            A report has been pre-filled in the <strong style={{ color: '#F5C842' }}>🐛 Feedback</strong> button at the bottom-left — tap it to send and we'll fix it fast.
          </p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            style={{ background: 'linear-gradient(135deg, #7C5CFC, #4B2FD0)', border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
  red: '#FF4D4D',
}


// ── Pricing constants (shared across create + edit flows) ─────
const DS_FEE   = 0.10   // 10% Dreamscape platform fee
const ST_PCT   = 0.029  // Stripe 2.9%
const ST_FIXED = 0.30   // Stripe $0.30

// Approximate Printful wholesale costs by product type (2025)
const PRINTFUL_BASE_COSTS = {
  'T-SHIRT': 12.95, 'SHIRT': 12.95, 'HOODIE': 27.95, 'SWEATSHIRT': 24.95,
  'LONG SLEEVE': 17.95, 'CROP': 15.95, 'TANK': 12.95, 'POLO': 19.95,
  'DRESS': 22.95, 'LEGGINGS': 21.95, 'SHORTS': 18.95, 'JOGGER': 24.95,
  'JACKET': 34.95, 'BOMBER': 38.95, 'MUG': 8.95, 'TRAVEL MUG': 16.95,
  'BOTTLE': 18.95, 'POSTER': 9.95, 'CANVAS': 29.95, 'CANVAS PRINT': 29.95, 'PRINT': 9.95,
  'FRAMED': 34.95, 'FRAMED POSTER': 34.95, 'FRAMED PRINT': 34.95,
  'METAL PRINT': 34.95, 'ACRYLIC PRINT': 39.95, 'WOOD PRINT': 29.95,
  'WALL ART': 24.95, 'ART PRINT': 14.95,
  'PHONE': 11.95, 'TOTE': 12.95, 'BAG': 14.95, 'BACKPACK': 29.95,
  'PILLOW': 17.95, 'BLANKET': 34.95, 'SOCKS': 10.95, 'HAT': 17.95,
  'CAP': 17.95, 'BEANIE': 15.95, 'APRON': 19.95, 'NOTEBOOK': 12.95,
}

function getPrintfulBaseCost(productType) {
  if (!productType) return null
  const upper = productType.toUpperCase()
  for (const [key, cost] of Object.entries(PRINTFUL_BASE_COSTS)) {
    if (upper.includes(key)) return cost
  }
  return null
}

function calcProfit(retailPrice, baseCost) {
  const retail = parseFloat(retailPrice) || 0
  if (retail <= 0 || baseCost == null) return null
  const stripeFee     = retail * ST_PCT + ST_FIXED
  const dreamscapeFee = retail * DS_FEE
  const earnings      = retail - baseCost - stripeFee - dreamscapeFee
  const margin        = (earnings / retail) * 100
  const breakEven     = (baseCost + ST_FIXED) / (1 - ST_PCT - DS_FEE)
  return { earnings, margin, breakEven, stripeFee, dreamscapeFee }
}

// ── Ctrl/Cmd+Click → new tab utility ─────────────────────────
// Call this in any onClick that would normally navigate internally.
// If the user holds Ctrl (PC) or Cmd (Mac), opens in a new tab instead.
const navOrNewTab = (e, path, navigate) => {
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    e.preventDefault()
    window.open(path, '_blank', 'noopener,noreferrer')
  } else {
    navigate(path)
  }
}

// ── Image protection ──────────────────────────────────────────
// Prevents casual right-click save and drag-to-desktop on artwork.
// Does not stop screenshots — that's OS level and unavoidable —
// but blocks 99% of casual copying and establishes IP ownership signal.
const protectedImgProps = (isOwner = false) => ({
  onContextMenu: isOwner ? undefined : (e) => e.preventDefault(),
  onDragStart: isOwner ? undefined : (e) => e.preventDefault(),
  style: { userSelect: 'none', WebkitUserSelect: 'none', WebkitUserDrag: isOwner ? 'auto' : 'none', pointerEvents: 'auto' },
})

// Wrap any img tag with this overlay to block interaction on public images
function ProtectedImage({ src, alt, style, isOwner = false, onClick, className }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', pointerEvents: onClick ? 'auto' : 'none', ...style }} onClick={onClick}>
      <img
        src={src}
        alt={alt}
        className={className}
        onContextMenu={isOwner ? undefined : e => e.preventDefault()}
        onDragStart={isOwner ? undefined : e => e.preventDefault()}
        style={{ width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none', WebkitUserDrag: isOwner ? 'auto' : 'none', display: 'block' }}
      />
      {/* Transparent overlay on non-owner images — blocks right-click targeting the img element */}
      {!isOwner && (
        <div
          onContextMenu={e => e.preventDefault()}
          style={{ position: 'absolute', inset: 0, background: 'transparent', userSelect: 'none' }}
        />
      )}
    </div>
  )
}

// ── Image utilities ───────────────────────────────────────────

// Upload a base64 dataUrl to Supabase Storage, return public URL.
// Used after image generation so we store a URL not raw base64 in the DB.
async function uploadArtworkToStorage(userId, base64DataUrl, mimeType = 'image/png') {
  try {
    const ext = mimeType.includes('jpeg') ? 'jpg' : 'png'
    const filename = `${userId}/${Date.now()}.${ext}`
    // Convert base64 to blob
    const res = await fetch(base64DataUrl)
    const blob = await res.blob()
    const { error } = await supabase.storage
      .from('artwork')
      .upload(filename, blob, { contentType: mimeType, upsert: false })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('artwork').getPublicUrl(filename)
    return publicUrl
  } catch (err) {
    console.warn('Storage upload failed, falling back to base64:', err.message)
    return null // caller falls back to base64
  }
}

// Apply Netlify Image CDN transform to any external URL.
// Returns optimised WebP at requested width — massively smaller than originals.
// Supabase storage URLs and Printful CDN URLs both work.
// Base64 dataUrls are passed through unchanged (can't be transformed).
function imgUrl(src, width = 800, quality = 80) {
  if (!src) return src
  if (src.startsWith('data:')) return src // base64 — can't transform
  if (src.startsWith('blob:')) return src  // local blob — can't transform
  // Netlify Image CDN — transforms any URL to WebP at specified width
  return `/.netlify/images?url=${encodeURIComponent(src)}&w=${width}&q=${quality}&fm=webp`
}

// ── LazyImage — blur-up placeholder + lazy load ───────────────
// Replaces every <img> on art/product cards for instant perceived performance.
function LazyImage({ src, alt, style, className, onClick, width = 800, quality = 80, priority = false, onBroken = null, resourceId = null, resourceType = null }) {
  const [loaded, setLoaded]     = useState(false)
  const [error, setError]       = useState(false)
  const [reported, setReported] = useState(false)
  const optimised = imgUrl(src, width, quality)

  const handleError = async () => {
    setError(true)
    setLoaded(true)
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
    <div style={{ position: 'relative', overflow: 'hidden', pointerEvents: onClick ? 'auto' : 'none', ...style }} onClick={onClick}>
      {!loaded && !error && (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(110deg, ${C.card} 30%, ${C.border} 50%, ${C.card} 70%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
      )}
      {src && !error && (
        <img
          src={optimised}
          alt={alt}
          className={className}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchpriority={priority ? 'high' : 'low'}
          onLoad={() => setLoaded(true)}
          onError={handleError}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease', display: 'block' }}
        />
      )}
      {error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `${C.accent}10`, gap: 6 }}>
          <span style={{ fontSize: 20, opacity: 0.35 }}>✦</span>
          <span style={{ fontSize: 10, color: C.muted, opacity: 0.5 }}>Unavailable</span>
        </div>
      )}
    </div>
  )
}


// ── Tier Limits ───────────────────────────────────────────────
const TIER_LIMITS = {
  free:       { gens: 10,       products: 3,        commission: 0.30 },
  starter:    { gens: 50,       products: 15,       commission: 0.25 },
  pro:        { gens: 200,      products: 50,       commission: 0.20 },
  studio:     { gens: Infinity, products: Infinity, commission: 0.15 },
  merchant:   { gens: 100,      products: Infinity, commission: 0.08 },
  brand:      { gens: 500,      products: Infinity, commission: 0.06 },
  enterprise: { gens: Infinity, products: Infinity, commission: 0.04 },
}

async function checkGenerationLimit(userId, tier) {
  if (tier === 'studio' || tier === 'enterprise') return { allowed: true, used: 0, limit: Infinity }
  const limit = TIER_LIMITS[tier]?.gens || 10
  const startOfMonth = new Date()
  startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0)
  const { count } = await supabase
    .from('artwork')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())
  return { allowed: (count || 0) < limit, used: count || 0, limit }
}

async function checkProductLimit(userId, tier) {
  if (tier === 'studio' || tier === 'merchant' || tier === 'brand' || tier === 'enterprise') return { allowed: true, used: 0, limit: Infinity }
  const limit = TIER_LIMITS[tier]?.products || 3
  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  return { allowed: (count || 0) < limit, used: count || 0, limit }
}


// ── Starfield Background ──────────────────────────────────────
// All random data computed once at module level — never inside render
// ── Pre-computed star data (stable across renders) ────────────
const STARS = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  top:      Math.random() * 100,
  left:     Math.random() * 100,
  size:     Math.random() * 2.2 + 0.4,
  dur:      Math.random() * 5 + 2,
  delay:    Math.random() * 10,
  opacity:  Math.random() * 0.8 + 0.15,
  color:    ['#ffffff','#e0d7ff','#c4b5fd','#67e8f9','#f0abfc','#fde68a','#a5f3fc'][Math.floor(Math.random() * 7)],
}))

// Fewer stars for mobile — pre-computed so they're stable
const STARS_MOBILE = STARS.slice(0, 30)

const SPARKLES = Array.from({ length: 25 }, (_, i) => ({
  id: i,
  top:    Math.random() * 100,
  left:   Math.random() * 100,
  size:   Math.random() * 10 + 5,
  color:  ['#c4b5fd','#67e8f9','#f0abfc','#fde68a','#ffffff','#a5f3fc'][i % 6],
  opacity: Math.random() * 0.22 + 0.04,
  dur:    Math.random() * 6 + 3,
  delay:  Math.random() * 8,
}))

function StarField() {
  // Detect mobile once on mount — avoids re-renders
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches

  if (isMobile) return <StarFieldMobile />
  return <StarFieldDesktop />
}

// ── Mobile StarField — GPU-safe, no blur filters ─────────────
// Uses CSS-only gradients instead of filter:blur(), no planets,
// reduced star count, slower animations, will-change: transform.
function StarFieldMobile() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', background: '#030508' }}>
      <style>{`
        @keyframes twinkle {
          0%,100% { opacity: var(--op); }
          50%      { opacity: calc(var(--op) * 0.3); }
        }
        @keyframes mobileNebula {
          0%,100% { opacity: var(--nb); }
          50%      { opacity: calc(var(--nb) * 1.2); }
        }
      `}</style>

      {/* 2 static nebula layers — NO blur filter, pure CSS gradient */}
      <div style={{ '--nb': 0.85, position: 'absolute', top: '-20%', left: '-15%', width: '80%', height: '80%',
        background: 'radial-gradient(ellipse 55% 60% at 40% 40%, rgba(88,28,220,0.45) 0%, rgba(124,92,252,0.28) 30%, transparent 65%)',
        animation: 'mobileNebula 12s ease-in-out infinite',
        willChange: 'opacity',
      }} />
      <div style={{ '--nb': 0.75, position: 'absolute', bottom: '-20%', right: '-15%', width: '80%', height: '75%',
        background: 'radial-gradient(ellipse 50% 55% at 60% 55%, rgba(219,39,119,0.38) 0%, rgba(168,85,247,0.22) 35%, transparent 65%)',
        animation: 'mobileNebula 16s ease-in-out infinite 4s',
        willChange: 'opacity',
      }} />
      <div style={{ '--nb': 0.6, position: 'absolute', top: '20%', right: '-5%', width: '55%', height: '55%',
        background: 'radial-gradient(ellipse 50% 50% at 55% 40%, rgba(14,165,233,0.3) 0%, rgba(0,212,170,0.18) 40%, transparent 68%)',
        animation: 'mobileNebula 20s ease-in-out infinite 8s',
        willChange: 'opacity',
      }} />

      {/* 30 point stars — opacity-only animation, no scale/blur */}
      {STARS_MOBILE.map(s => (
        <div key={s.id} style={{
          position: 'absolute',
          top: `${s.top}%`, left: `${s.left}%`,
          width: s.size, height: s.size,
          borderRadius: '50%',
          background: s.color,
          '--op': s.opacity,
          opacity: s.opacity,
          animation: `twinkle ${s.dur * 1.5}s ease-in-out infinite`,
          animationDelay: `${s.delay}s`,
          willChange: 'opacity',
        }} />
      ))}
    </div>
  )
}

// ── Desktop StarField — full experience ───────────────────────
function StarFieldDesktop() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', background: '#030508' }}>
      <style>{`
        @keyframes twinkle {
          0%,100% { opacity: var(--op); transform: scale(1); }
          40%      { opacity: calc(var(--op) * 0.3); }
          70%      { opacity: calc(var(--op) * 2.8); transform: scale(1.5); filter: blur(0.3px); }
        }
        @keyframes nebulaFloat1 {
          0%   { transform: translate(0px, 0px) scale(1) rotate(0deg); }
          25%  { transform: translate(22px,-14px) scale(1.04) rotate(2deg); }
          50%  { transform: translate(-16px, 20px) scale(0.97) rotate(-2deg); }
          75%  { transform: translate(18px, 8px) scale(1.02) rotate(3deg); }
          100% { transform: translate(0px, 0px) scale(1) rotate(0deg); }
        }
        @keyframes nebulaFloat2 {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(-28px, 18px) scale(1.06); }
          66%  { transform: translate(20px,-24px) scale(0.95); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes nebulaFloat3 {
          0%   { transform: translate(0px, 0px) rotate(0deg); }
          50%  { transform: translate(12px,-30px) rotate(5deg); }
          100% { transform: translate(0px, 0px) rotate(0deg); }
        }
        @keyframes nebulaBreath {
          0%,100% { opacity: var(--nb); }
          50%      { opacity: calc(var(--nb) * 1.3); }
        }
        @keyframes planetFloat {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes moonPulse {
          0%,100% { box-shadow: 0 0 24px rgba(180,160,255,0.35), 0 0 48px rgba(124,92,252,0.2), 0 0 90px rgba(124,92,252,0.08); }
          50%      { box-shadow: 0 0 40px rgba(180,160,255,0.55), 0 0 80px rgba(124,92,252,0.35), 0 0 140px rgba(124,92,252,0.15); }
        }
        @keyframes chromaticBorder {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      {/* Layer 1 — Giant diffuse nebula base */}
      <div style={{ '--nb': 0.9, position: 'absolute', top: '-30%', left: '-20%', width: '90%', height: '90%',
        background: 'radial-gradient(ellipse 55% 60% at 40% 40%, rgba(88,28,220,0.55) 0%, rgba(124,92,252,0.4) 18%, rgba(75,47,208,0.25) 35%, rgba(99,60,200,0.12) 55%, transparent 72%)',
        filter: 'blur(55px)', animation: 'nebulaFloat1 32s ease-in-out infinite, nebulaBreath 11s ease-in-out infinite' }} />
      <div style={{ '--nb': 0.85, position: 'absolute', bottom: '-30%', right: '-25%', width: '95%', height: '85%',
        background: 'radial-gradient(ellipse 50% 55% at 60% 55%, rgba(219,39,119,0.5) 0%, rgba(168,85,247,0.35) 20%, rgba(236,72,153,0.2) 40%, rgba(124,92,252,0.1) 60%, transparent 78%)',
        filter: 'blur(50px)', animation: 'nebulaFloat2 40s ease-in-out infinite, nebulaBreath 14s ease-in-out infinite 3s' }} />

      {/* Layer 2 — Mid-ground nebula detail */}
      <div style={{ '--nb': 0.7, position: 'absolute', top: '15%', left: '20%', width: '70%', height: '65%',
        background: 'radial-gradient(ellipse 45% 50% at 52% 48%, rgba(0,212,170,0.28) 0%, rgba(6,182,212,0.2) 22%, rgba(14,165,233,0.12) 45%, rgba(124,92,252,0.08) 65%, transparent 80%)',
        filter: 'blur(45px)', animation: 'nebulaFloat3 25s ease-in-out infinite' }} />
      <div style={{ '--nb': 0.8, position: 'absolute', top: '20%', left: '-8%', width: '40%', height: '70%',
        background: 'radial-gradient(ellipse 40% 70% at 35% 50%, rgba(109,40,217,0.5) 0%, rgba(124,92,252,0.32) 25%, rgba(91,33,182,0.18) 50%, transparent 72%)',
        filter: 'blur(40px)', animation: 'nebulaFloat1 20s ease-in-out infinite reverse, nebulaBreath 9s ease-in-out infinite 1s' }} />
      <div style={{ '--nb': 0.65, position: 'absolute', top: '-15%', right: '-10%', width: '60%', height: '65%',
        background: 'radial-gradient(ellipse 55% 45% at 55% 38%, rgba(14,165,233,0.45) 0%, rgba(0,212,170,0.28) 25%, rgba(56,189,248,0.15) 50%, rgba(124,92,252,0.08) 68%, transparent 82%)',
        filter: 'blur(38px)', animation: 'nebulaFloat2 28s ease-in-out infinite reverse' }} />
      <div style={{ '--nb': 0.55, position: 'absolute', bottom: '-15%', left: '-5%', width: '55%', height: '50%',
        background: 'radial-gradient(ellipse 50% 45% at 42% 62%, rgba(245,158,11,0.28) 0%, rgba(251,146,60,0.2) 22%, rgba(236,72,153,0.15) 45%, transparent 70%)',
        filter: 'blur(42px)', animation: 'nebulaFloat3 22s ease-in-out infinite, nebulaBreath 16s ease-in-out infinite 4s' }} />

      {/* Layer 3 — Fine nebula detail */}
      <div style={{ '--nb': 0.9, position: 'absolute', top: '8%', left: '32%', width: '28%', height: '28%',
        background: 'radial-gradient(ellipse 60% 55% at 50% 45%, rgba(167,139,250,0.55) 0%, rgba(139,92,246,0.35) 20%, rgba(124,92,252,0.15) 45%, transparent 65%)',
        filter: 'blur(22px)', animation: 'nebulaFloat1 18s ease-in-out infinite 2s, nebulaBreath 7s ease-in-out infinite' }} />
      <div style={{ '--nb': 0.75, position: 'absolute', top: '38%', right: '5%', width: '32%', height: '35%',
        background: 'radial-gradient(ellipse 55% 60% at 58% 45%, rgba(34,211,238,0.45) 0%, rgba(6,182,212,0.28) 25%, rgba(0,212,170,0.12) 50%, transparent 68%)',
        filter: 'blur(25px)', animation: 'nebulaFloat2 15s ease-in-out infinite 1s, nebulaBreath 8s ease-in-out infinite 2s' }} />
      <div style={{ '--nb': 0.7, position: 'absolute', top: '52%', left: '18%', width: '26%', height: '30%',
        background: 'radial-gradient(ellipse 50% 55% at 45% 50%, rgba(244,114,182,0.48) 0%, rgba(236,72,153,0.3) 22%, rgba(168,85,247,0.15) 48%, transparent 65%)',
        filter: 'blur(20px)', animation: 'nebulaFloat3 19s ease-in-out infinite reverse, nebulaBreath 10s ease-in-out infinite 3s' }} />
      <div style={{ '--nb': 0.6, position: 'absolute', top: '28%', left: '45%', width: '20%', height: '22%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.12) 0%, rgba(196,181,253,0.18) 30%, rgba(167,243,252,0.1) 55%, transparent 72%)',
        filter: 'blur(16px)', animation: 'nebulaFloat1 12s ease-in-out infinite 4s' }} />
      <div style={{ '--nb': 0.5, position: 'absolute', top: '44%', left: '-5%', width: '80%', height: '18%',
        background: 'radial-gradient(ellipse 80% 40% at 40% 50%, rgba(30,64,175,0.22) 0%, rgba(29,78,216,0.12) 40%, transparent 70%)',
        filter: 'blur(30px)', animation: 'nebulaFloat2 35s ease-in-out infinite 2s' }} />

      {/* Moon */}
      <div style={{ position: 'absolute', top: '5%', right: '7%', width: 58, height: 58, borderRadius: '50%',
        background: 'radial-gradient(circle at 36% 32%, rgba(255,255,255,0.95) 0%, #e8e0ff 12%, #c4b5fd 30%, #a78bfa 52%, #7c3aed 75%, #4c1d95 100%)',
        animation: 'moonPulse 6s ease-in-out infinite, planetFloat 11s ease-in-out infinite' }}>
        <div style={{ position: 'absolute', top: '18%', left: '12%', width: 10, height: 8, borderRadius: '50%', background: 'rgba(109,40,217,0.3)', filter: 'blur(2px)' }} />
        <div style={{ position: 'absolute', top: '55%', left: '28%', width: 6, height: 6, borderRadius: '50%', background: 'rgba(109,40,217,0.25)', filter: 'blur(1.5px)' }} />
        <div style={{ position: 'absolute', top: '8%', right: '4%', width: '65%', height: '82%', borderRadius: '50%', background: 'rgba(10,5,30,0.4)', filter: 'blur(4px)' }} />
        <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', background: 'transparent', boxShadow: 'inset 0 0 12px rgba(167,139,250,0.4)' }} />
      </div>

      {/* Planet 1 — teal ringed */}
      <div style={{ position: 'absolute', bottom: '10%', left: '4%', animation: 'planetFloat 14s ease-in-out infinite 2s' }}>
        <div style={{ position: 'relative', width: 50, height: 50 }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%',
            background: 'radial-gradient(circle at 33% 28%, rgba(103,232,249,0.9) 0%, #06b6d4 25%, #0891b2 50%, #0e7490 75%, #083344 100%)',
            boxShadow: '0 0 18px rgba(6,182,212,0.5), 0 0 36px rgba(0,212,170,0.25), 0 0 60px rgba(0,212,170,0.1)' }} />
          <div style={{ position: 'absolute', top: '30%', left: '5%', width: '90%', height: '12%', borderRadius: 4, background: 'rgba(255,255,255,0.08)', filter: 'blur(2px)' }} />
          <div style={{ position: 'absolute', top: '55%', left: '8%', width: '84%', height: '8%', borderRadius: 4, background: 'rgba(255,255,255,0.05)', filter: 'blur(2px)' }} />
          <div style={{ position: 'absolute', top: '38%', left: '-32%', width: '164%', height: '24%',
            border: '1.5px solid rgba(103,232,249,0.55)', borderRadius: '50%',
            boxShadow: '0 0 6px rgba(6,182,212,0.35), inset 0 0 4px rgba(6,182,212,0.2)',
            transform: 'rotateX(72deg)' }} />
          <div style={{ position: 'absolute', top: '30%', left: '-42%', width: '184%', height: '40%',
            border: '1px solid rgba(103,232,249,0.2)', borderRadius: '50%',
            transform: 'rotateX(72deg)' }} />
        </div>
      </div>

      {/* Planet 2 — small purple */}
      <div style={{ position: 'absolute', top: '24%', left: '2%', width: 18, height: 18, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #e9d5ff 0%, #a855f7 45%, #6b21a8 80%, #3b0764 100%)',
        boxShadow: '0 0 10px rgba(168,85,247,0.55), 0 0 20px rgba(168,85,247,0.2)',
        animation: 'planetFloat 8s ease-in-out infinite 1s' }} />

      {/* Planet 3 — tiny warm */}
      <div style={{ position: 'absolute', top: '68%', right: '12%', width: 10, height: 10, borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 35%, #fde68a 0%, #f59e0b 50%, #b45309 100%)',
        boxShadow: '0 0 8px rgba(245,158,11,0.5)',
        animation: 'planetFloat 6s ease-in-out infinite 3s' }} />

      {/* Point stars */}
      {STARS.map(s => (
        <div key={s.id} style={{
          position: 'absolute',
          top: `${s.top}%`, left: `${s.left}%`,
          width: s.size, height: s.size,
          borderRadius: '50%',
          background: s.color,
          '--op': s.opacity,
          opacity: s.opacity,
          boxShadow: `0 0 ${s.size * 2.5}px ${s.color}`,
          animation: `twinkle ${s.dur}s ease-in-out infinite`,
          animationDelay: `${s.delay}s`,
        }} />
      ))}

      {/* Sparkle glyphs */}
      {SPARKLES.map(s => (
        <div key={`sp${s.id}`} style={{
          position: 'absolute',
          top: `${s.top}%`, left: `${s.left}%`,
          fontSize: `${s.size}px`,
          color: s.color,
          opacity: s.opacity,
          textShadow: '0 0 10px currentColor, 0 0 20px currentColor',
          animation: `twinkle ${s.dur}s ease-in-out infinite`,
          animationDelay: `${s.delay}s`,
          userSelect: 'none', lineHeight: 1,
        }}>✦</div>
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

  // Aggressively fix overflow on every navigation — prevents blank page bug
  useEffect(() => {
    document.body.style.overflow = ''
    document.body.style.height = ''
    document.documentElement.style.overflow = ''
    document.documentElement.style.height = ''
    document.body.classList.add('app-ready')
    // Double-check after a tick in case something re-sets it
    const t = setTimeout(() => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }, 50)
    return () => clearTimeout(t)
  }, [location])
}


// ── Loading Spinner + Art Skeleton ───────────────────────────
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
      <div style={{ textAlign: 'center', marginBottom: 20, minHeight: 28 }}>
        <span style={{ fontSize: 13, color: C.accent, fontStyle: 'italic' }}>
          ✦ {LOADING_QUOTES[quoteIdx]}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} style={{ borderRadius: 16, overflow: 'hidden', background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ height: 160, background: `linear-gradient(110deg, ${C.card} 30%, ${C.border} 50%, ${C.card} 70%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
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
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
      </div>
      {label && <p style={{ fontSize: 12, color: C.muted, margin: 0, fontStyle: 'italic' }}>{label}</p>}
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

// ── Generation Usage Counter ──────────────────────────────────
function GenUsageCounter({ user }) {
  const [usage, setUsage] = useState(null)
  const [tier, setTier] = useState('free')

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const load = async () => {
      try {
        const { data: prof } = await supabase.from('profiles').select('subscription_tier').eq('id', user.id).single()
        if (cancelled) return
        const t = prof?.subscription_tier || 'free'
        setTier(t)
        if (t === 'studio') { setUsage({ used: '∞', limit: '∞' }); return }
        const check = await checkGenerationLimit(user.id, t)
        if (cancelled) return
        setUsage({ used: check.used, limit: check.limit })
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [user?.id])

  if (!usage) return null
  if (tier === 'studio') return (
    <span style={{ fontSize: 11, color: C.gold, fontWeight: 600, background: C.gold + '18', border: `1px solid ${C.gold}33`, borderRadius: 10, padding: '3px 9px' }}>∞ Studio</span>
  )
  if (tier === 'merchant') return (
    <span style={{ fontSize: 11, color: '#FF6B4A', fontWeight: 600, background: 'rgba(255,107,74,0.15)', border: '1px solid rgba(255,107,74,0.3)', borderRadius: 10, padding: '3px 9px' }}>🏪 Merchant</span>
  )
  if (tier === 'brand') return (
    <span style={{ fontSize: 11, color: '#FF4F9A', fontWeight: 600, background: 'rgba(255,79,154,0.15)', border: '1px solid rgba(255,79,154,0.3)', borderRadius: 10, padding: '3px 9px' }}>🏷 Brand</span>
  )
  if (tier === 'enterprise') return (
    <span style={{ fontSize: 11, color: C.gold, fontWeight: 600, background: `${C.gold}18`, border: `1px solid ${C.gold}44`, borderRadius: 10, padding: '3px 9px' }}>🏢 Enterprise</span>
  )

  const pct = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0
  const color = pct >= 90 ? '#FF4D4D' : pct >= 70 ? C.gold : C.teal

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted }}>
      <div style={{ width: 48, height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <span style={{ color, fontWeight: 600 }}>{usage.used}/{usage.limit}</span>
    </div>
  )
}

// ── Dream AI Chat ─────────────────────────────────────────────
const INITIAL_MESSAGE = { role: 'assistant', content: "✨ Hey! I'm Dream. What are we creating today?" }

// ── Generate button helper (avoids IIFE in JSX) ──────────────
function GenerateButton({ pendingPrompt, lastGenerationPromptRef, generatingIndex, messages, setPendingPrompt, generateImage, handleSend }) {
  const isReady = !!(pendingPrompt || lastGenerationPromptRef.current)
  const isGenerating = generatingIndex !== null
  const MESSAGES = [
    '✨ Making dreams come true...',
    '🎨 Painting your vision...',
    '🌌 Bending reality...',
    '⚡ Conjuring something epic...',
    '🔮 Reading your mind...',
    '🌀 Warping the cosmos...',
    '💫 Channeling the muse...',
    '🎭 Bringing it to life...',
  ]
  return (
    <button onClick={() => {
      if (isGenerating) return
      if (pendingPrompt) {
        const { prompt, refImage } = pendingPrompt
        setPendingPrompt(null)
        lastGenerationPromptRef.current = prompt
        generateImage(prompt, messages.length - 1, refImage)
      } else if (lastGenerationPromptRef.current) {
        generateImage(lastGenerationPromptRef.current, messages.length - 1)
      } else {
        handleSend('generate')
      }
    }} disabled={isGenerating}
      style={{
        background: isGenerating
          ? `linear-gradient(135deg, ${C.teal}88, #00A88488)`
          : `linear-gradient(135deg, ${C.teal}, #00A884)`,
        border: `1px solid ${C.teal}88`,
        borderRadius: 8, padding: '8px 16px',
        color: '#fff', fontSize: 12, fontWeight: 700,
        cursor: isGenerating ? 'not-allowed' : 'pointer',
        animation: isReady && !isGenerating ? 'generatePulse 2s ease-in-out infinite, generateReady 3s ease-in-out infinite' : 'none',
        minWidth: 180, textAlign: 'center',
        transition: 'background 0.3s',
      }}>
      {isGenerating ? MESSAGES[generatingIndex % 8] : '✦ Generate Image'}
    </button>
  )
}

function DreamChat({ user, onSignIn }) {
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saveTarget, setSaveTarget] = useState(null)
  const [savedIndexes, setSavedIndexes] = useState(new Set())
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [generatingIndex, setGeneratingIndex] = useState(null)
  const [generatedImages, setGeneratedImages] = useState({})
  const [pendingPrompt, setPendingPrompt] = useState(null)
  const lastGenerationPromptRef = useRef(null) // persists real prompt across retries
  const [lightboxImage, setLightboxImage] = useState(null)
  const [createProductImage, setCreateProductImage] = useState(null)
  const bottomRef = useRef(null)
  const [referenceImage, setReferenceImage] = useState(null)
  const fileInputRef = useRef(null)
  const mountedRef = useRef(true)
  const genTimeoutRef = useRef(null)
  const [autoSavedIds, setAutoSavedIds] = useState({})
  const [publishedIds, setPublishedIds] = useState(new Set())
  const inputRef = useRef(null)
  const [aspectRatio, setAspectRatio] = useState('square')   // square | portrait | landscape | wide

  const SIZE_OPTIONS = [
    { id: 'square',    label: '■ Square',    hint: 'T-shirts, mugs, profile',   ratio: '1:1'   },
    { id: 'portrait',  label: '▯ Portrait',  hint: 'Phone cases, prints, cards', ratio: '3:4'   },
    { id: 'landscape', label: '▭ Landscape', hint: 'Banners, pillows, bags',     ratio: '4:3'   },
    { id: 'wide',      label: '▬ Wide',      hint: 'Posters, art prints, wall',  ratio: '16:9'  },
  ]

  const PROMPT_CHIPS = [
    '🐿️ A squirrel as a mad scientist',
    '🌌 Epic space battle at sunrise',
    '🐉 Neon dragon in cyberpunk city',
    '🦁 Lion wearing a crown of flowers',
    '🤖 Robot playing jazz in New Orleans',
    '🌊 Surfer riding a wave made of stars',
    '🦊 Fox as a ninja in ancient Japan',
    '🎭 Colorful carnival at midnight',
  ]

  // ── Session history ───────────────────────────────────────────
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const autoSaveTimerRef = useRef(null)

  // Auto-save current session to Supabase (debounced 2s)
  const autoSaveSession = useCallback(async (msgs, sessionId) => {
    if (!user || msgs.length < 2) return // don't save empty sessions
    clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return
      // Title = first user message, truncated
      const firstUser = msgs.find(m => m.role === 'user')
      const title = typeof firstUser?.content === 'string'
        ? firstUser.content.slice(0, 60)
        : firstUser?.content?.find?.(c => c.type === 'text')?.text?.slice(0, 60) || 'Dream Session'

      // Strip base64 images from saved messages to keep DB lean
      const saveable = msgs.map(m => {
        if (Array.isArray(m.content)) {
          const text = m.content.find(c => c.type === 'text')
          return { ...m, content: text?.text || '', _refImage: undefined }
        }
        return { ...m, _refImage: undefined }
      })

      if (sessionId) {
        await supabase.from('dream_sessions')
          .update({ messages: saveable, title, updated_at: new Date().toISOString() })
          .eq('id', sessionId)
      } else {
        const { data } = await supabase.from('dream_sessions')
          .insert({ user_id: user.id, title, messages: saveable })
          .select('id').single()
        if (data?.id && mountedRef.current) setCurrentSessionId(data.id)
      }
    }, 2000)
  }, [user])

  // Load session history list
  const loadSessions = async () => {
    if (!user) return
    setLoadingSessions(true)
    const { data } = await supabase
      .from('dream_sessions')
      .select('id, title, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(40)
    if (mountedRef.current) { setSessions(data || []); setLoadingSessions(false) }
  }

  // Resume a past session
  const resumeSession = async (session) => {
    const { data } = await supabase
      .from('dream_sessions')
      .select('messages')
      .eq('id', session.id)
      .single()
    if (!data?.messages) return
    setMessages(data.messages.length ? data.messages : [INITIAL_MESSAGE])
    setGeneratedImages({})
    setSavedIndexes(new Set())
    setGeneratingIndex(null)
    setPendingPrompt(null)
    setAutoSavedIds({})
    setPublishedIds(new Set())
    setCurrentSessionId(session.id)
    setShowHistory(false)
  }

  // Delete a session
  const deleteSession = async (e, sessionId) => {
    e.stopPropagation()
    await supabase.from('dream_sessions').delete().eq('id', sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (currentSessionId === sessionId) resetChat()
  }

  // Auto-save whenever messages change (after first user message)
  useEffect(() => {
    if (messages.length > 1) autoSaveSession(messages, currentSessionId)
  }, [messages])

  // Track mounted state — prevent setState after unmount
  useEffect(() => {
    mountedRef.current = true
    const refinePrompt = sessionStorage.getItem('dreamRefinePrompt')
    if (refinePrompt) {
      sessionStorage.removeItem('dreamRefinePrompt')
      setInput(`Refine this prompt: ${refinePrompt}`)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    return () => {
      mountedRef.current = false
      if (genTimeoutRef.current) clearTimeout(genTimeoutRef.current)
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [])





  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])





  const resetChat = () => {
    setMessages([INITIAL_MESSAGE])
    setInput('')
    setGeneratedImages({})
    setSavedIndexes(new Set())
    setSaveTarget(null)
    setGeneratingIndex(null)
    setLightboxImage(null)
    setCreateProductImage(null)
    setReferenceImage(null)
    setSaveSuccess(false)
    setAutoSavedIds({})
    setPublishedIds(new Set())
    setCurrentSessionId(null)
    setPendingPrompt(null)
    lastGenerationPromptRef.current = null
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Clear input value immediately so the same file can be re-selected
    // We've already grabbed the file reference above so this is safe
    e.target.value = ''

    // If the file is a HEIC/HEIF (common from iPhone camera), the canvas
    // API can't always decode it. Fall back to reading it as-is via FileReader.
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')

    if (isHeic) {
      // Can't resize HEIC reliably — just pass it through at original quality
      const reader = new FileReader()
      reader.onload = ev => setReferenceImage({ dataUrl: ev.target.result, mimeType: file.type || 'image/jpeg', name: file.name })
      reader.readAsDataURL(file)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onerror = () => {
      // Canvas can't decode this format — read raw as fallback
      URL.revokeObjectURL(objectUrl)
      const reader = new FileReader()
      reader.onload = ev => setReferenceImage({ dataUrl: ev.target.result, mimeType: file.type || 'image/jpeg', name: file.name })
      reader.readAsDataURL(file)
    }

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const MAX = 800
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX }
        else { width = Math.round(width * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        if (!blob) {
          // Canvas produced no blob — fall back to raw file
          const reader = new FileReader()
          reader.onload = ev => setReferenceImage({ dataUrl: ev.target.result, mimeType: file.type || 'image/jpeg', name: file.name })
          reader.readAsDataURL(file)
          return
        }
        const reader = new FileReader()
        reader.onload = ev => setReferenceImage({ dataUrl: ev.target.result, mimeType: 'image/jpeg', name: file.name })
        reader.readAsDataURL(blob)
      }, 'image/jpeg', 0.75)
    }

    img.src = objectUrl
  }

  const send = async () => {
    if (!input.trim() || loading) return

    // If user says yes/go after a prompt is ready — generate immediately
    const YES_TRIGGERS = [
      'yes', 'yeah', 'yep', 'yup', 'go', 'go!', 'go for it', 'do it', 'do it!',
      'make it', 'generate', 'create', 'create it', "let's go", "let's do it",
      'yes please', 'go ahead', 'absolutely', 'sure', 'perfect', 'love it',
      'affirm', 'approved', 'approve', 'confirmed', 'confirm', 'proceed',
      'make this', 'do this', 'run it', 'fire', 'fire it', 'send it',
      'make it happen', 'lets go', 'yesss', 'yasss', 'hell yes', 'hell yeah',
    ]
    const inputLower = input.trim().toLowerCase()
    const isYesTrigger = YES_TRIGGERS.some(t => inputLower === t || inputLower.startsWith(t + ' ') || inputLower.endsWith(' ' + t))
    if (isYesTrigger && pendingPrompt) {
      setMessages(prev => [...prev, { role: 'user', content: input.trim() }])
      setInput('')
      const { prompt, refImage } = pendingPrompt
      setPendingPrompt(null)
      lastGenerationPromptRef.current = prompt // persist for retries
      generateImage(prompt, messages.length + 1, refImage)
      return
    }

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
    // Strip base64 images from history — only the current message carries the image.
    // Prevents payload from growing with every follow-up message, avoiding Netlify's 6MB body limit.
    const sanitizedHistory = messages
      .filter((_, i) => i > 0)
      .map(msg => {
        if (Array.isArray(msg.content)) {
          const textPart = msg.content.find(c => c.type === 'text')
          return { role: msg.role, content: textPart?.text || '[reference image attached]' }
        }
        return { role: msg.role, content: msg.content }
      })
    const history = [...sanitizedHistory, { role: 'user', content: userContent }]
    const currentRef = referenceImage?.dataUrl || null
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setReferenceImage(null)
    setLoading(true)

    try {
      const authHdr = await getAuthHeader()
      const res = await fetch('/api/dream', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHdr }, body: JSON.stringify({ messages: history }) })
      const data = await res.json()

      if (!mountedRef.current) return
      if (data.error) {
        const errorCode = `DS-${Date.now().toString(36).toUpperCase()}`
        setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong. Please try again. (${errorCode})`, isError: true }])
        window.dispatchEvent(new CustomEvent('dreamscape:error', { detail: {
          category: 'generation',
          message: `Dream AI error (${errorCode})\n\nError: ${JSON.stringify(data.error).slice(0, 200)}\nPage: ${window.location.pathname}`,
          page: window.location.pathname,
        }}))
        setLoading(false)
        return
      }

      if (!mountedRef.current) return

      // Use the backend reply as-is — Dream's system prompt already tells the user to generate
      const replyContent = data.reply || "Tell me more about what you're imagining..."
      setMessages(prev => [...prev, { role: 'assistant', content: replyContent }])
      setLoading(false)

      // Store the generation prompt silently — Generate button will appear
      if (data.generationPrompt && mountedRef.current) {
        setPendingPrompt({ prompt: data.generationPrompt, refImage: currentRef })
        lastGenerationPromptRef.current = data.generationPrompt // persist for retries
      }
    } catch {
      if (mountedRef.current) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.', isError: true }])
        setLoading(false)
      }
    }
  }

  const handleSave = async ({ title, prompt, styleTags, imageUrl }) => {
    const { error } = await supabase.from('artwork').insert({ user_id: user.id, title, prompt, image_url: imageUrl || '', style_tags: styleTags })
    if (!error) {
      setSavedIndexes(prev => new Set([...prev, saveTarget.index]))
      setSaveTarget(null); setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  const generateImage = async (prompt, index, refImage = null, ratio = null) => {
    if (!prompt || typeof prompt !== 'string') return
    if (!mountedRef.current) return
    // Check generation limit
    if (user) {
      try {
        const { data: profData } = await supabase.from('profiles').select('subscription_tier').eq('id', user.id).single()
        if (!mountedRef.current) return
        const tier = profData?.subscription_tier || 'free'
        const check = await checkGenerationLimit(user.id, tier)
        if (!mountedRef.current) return
        if (!check.allowed) {
          const tierName = tier.charAt(0).toUpperCase() + tier.slice(1)
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `⚠️ You've used all ${check.limit} generations this month on the ${tierName} plan.`,
            isLimit: true,
          }])
          return
        }
      } catch {}
    }
    if (!mountedRef.current) return
    setGeneratingIndex(index)
    try {
      const lastUserWithImage = refImage || [...messages].reverse().find(m => m._refImage)?._refImage || null
      const genAuthHdr = await getAuthHeader()
      const res = await fetch('/api/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...genAuthHdr },
        body: JSON.stringify({ prompt, referenceImage: lastUserWithImage, aspectRatio })
      })
      if (!mountedRef.current) return
      const data = await res.json()
      if (!mountedRef.current) return
      if (data.success) {
        const imageDataUrl = `data:${data.mimeType};base64,${data.imageData}`
        setGeneratedImages(prev => ({ ...prev, [index]: imageDataUrl }))
        // Auto-save to artwork — upload to Storage first so we store a URL not raw base64
        if (user) {
          const promptText = typeof prompt === 'string' ? prompt : ''
          // Derive a smart title from the prompt — take first 6 words, title-case them
          const smartTitle = promptText
            ? promptText.split(' ').slice(0, 6).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') + (promptText.split(' ').length > 6 ? '...' : '')
            : 'AI Artwork'
          // Try to upload to Supabase Storage for efficient CDN delivery
          const storageUrl = await uploadArtworkToStorage(user.id, imageDataUrl, data.mimeType || 'image/png')
          const finalImageUrl = storageUrl || imageDataUrl // fall back to base64 if upload fails
          const { data: savedArt } = await supabase.from('artwork').insert({
            user_id: user.id,
            title: smartTitle,
            prompt: promptText,
            image_url: finalImageUrl,
            style_tags: [],
            is_public: false,
          }).select().single()
          if (savedArt && mountedRef.current) {
            setAutoSavedIds(prev => ({ ...prev, [index]: savedArt.id }))
          }
        }
      } else {
        const code = data.errorCode || ''
        const type = data.errorType || ''
        let msg
        if (type === 'content_policy') {
          msg = `⚠️ The image model blocked that request — this sometimes happens with certain content combinations. Try rephrasing or hitting Retry, it often works on the next attempt. If your prompt includes real named people (celebrities, politicians etc.) try describing the vibe instead.`
        } else if (type === 'unavailable') {
          // Auto-retry once silently after 3s before showing the error
          if (!refImage && mountedRef.current) {
            await new Promise(r => setTimeout(r, 3000))
            if (mountedRef.current) {
              try {
                const retryRes = await fetch('/api/generate-image', {
                  method: 'POST', headers: { 'Content-Type': 'application/json', ...genAuthHdr },
                  body: JSON.stringify({ prompt, referenceImage: null, aspectRatio })
                })
                const retryData = await retryRes.json()
                if (retryData?.success && mountedRef.current) {
                  const imageDataUrl = `data:${retryData.mimeType};base64,${retryData.imageData}`
                  setGeneratedImages(prev => ({ ...prev, [index]: imageDataUrl }))
                  setGeneratingIndex(null)
                  return // silent retry succeeded — no error shown
                }
              } catch {}
            }
          }
          msg = `⚠️ Image generation is temporarily unavailable. Please try again in a moment.${code ? ` (${code})` : ''}`
          window.dispatchEvent(new CustomEvent('dreamscape:error', { detail: {
            category: 'generation',
            message: `Generation unavailable${code ? ` (${code})` : ''}\n\nPrompt: ${typeof prompt === 'string' ? prompt.slice(0, 300) : ''}`,
            page: window.location.pathname,
          }}))
        } else {
          msg = `⚠️ Image generation failed. Try rephrasing or click Generate again.${code ? ` (${code})` : ''}`
          window.dispatchEvent(new CustomEvent('dreamscape:error', { detail: {
            category: 'generation',
            message: `Generation failed${code ? ` (${code})` : ''}\n\nError: ${data.error || 'unknown'}\nPrompt: ${typeof prompt === 'string' ? prompt.slice(0, 300) : ''}`,
            page: window.location.pathname,
          }}))
        }
        setMessages(prev => [...prev, { role: 'assistant', content: msg, isError: true }])
      }
    } catch {
      if (mountedRef.current) {
        const errorCode = `DS-${Date.now().toString(36).toUpperCase()}`
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Connection error during generation. Please try again. (${errorCode})`, isError: true }])
        window.dispatchEvent(new CustomEvent('dreamscape:error', { detail: {
          category: 'generation',
          message: `Connection error during generation (${errorCode})\n\nPrompt: ${typeof prompt === 'string' ? prompt.slice(0, 300) : ''}`,
          page: window.location.pathname,
        }}))
      }
    } finally {
      if (mountedRef.current) setGeneratingIndex(null)
    }
  }

  const togglePublish = async (index) => {
    const artworkId = autoSavedIds[index]
    if (!artworkId) return
    const isPublished = publishedIds.has(artworkId)
    const { error } = await supabase.from('artwork').update({ is_public: !isPublished }).eq('id', artworkId)
    if (!error) {
      setPublishedIds(prev => {
        const next = new Set(prev)
        isPublished ? next.delete(artworkId) : next.add(artworkId)
        return next
      })
    }
  }

  const refineImage = (index) => {
    const promptText = typeof messages[index]?.content === 'string' ? messages[index].content : ''
    setInput('Refine this: ')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const ERROR_MSGS = ['Connection error. Please try again.', 'Sorry, something went wrong. Please try again.']
  const lastAiIndex = messages.reduce((last, msg, i) => {
    if (msg.role === 'assistant' && i > 0 && !ERROR_MSGS.includes(msg.content)) return i
    return last
  }, -1)

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
      {/* ── Chromatic animated border wrapper ── */}
      <div style={{ position: 'relative', borderRadius: 18, isolation: 'isolate' }}>
        {/* Glow layer 1 — crisp 2px chromatic ring */}
        <div style={{ position: 'absolute', inset: -2, borderRadius: 18, zIndex: 0, background: 'linear-gradient(135deg, #7C5CFC, #00D4AA, #FF6B9D, #F5C842, #7C5CFC)', backgroundSize: '300% 300%', animation: 'chromaticBorder 4s ease-in-out infinite', filter: 'blur(1px)' }} />
        {/* Glow layer 2 — diffuse ambient halo */}
        <div style={{ position: 'absolute', inset: -4, borderRadius: 20, zIndex: -1, background: 'linear-gradient(135deg, #7C5CFC88, #00D4AA44, #FF6B9D44, #7C5CFC88)', backgroundSize: '300% 300%', animation: 'chromaticBorder 4s ease-in-out infinite reverse', filter: 'blur(12px)' }} />
        {/* Inner card */}
        <div style={{ background: C.card, border: 'none', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✦</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Dream AI</div>
            <div style={{ fontSize: 11, color: C.teal }}>● online</div>
          </div>
          {/* History button */}
          <button onClick={() => { setShowHistory(h => { if (!h) loadSessions(); return !h }) }}
            title="Conversation history"
            style={{ background: showHistory ? `${C.accent}30` : `${C.accent}18`, border: `1px solid ${showHistory ? C.accent + '88' : C.accent + '44'}`, borderRadius: 8, padding: '6px 12px', color: C.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            🕐 History
          </button>
          {messages.length > 1 && (
            <button onClick={resetChat}
              title="Start a new conversation"
              style={{ background: `${C.teal}18`, border: `1px solid ${C.teal}44`, borderRadius: 8, padding: '6px 14px', color: C.teal, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              + New
            </button>
          )}
        </div>

        {/* History panel — slides in over the chat */}
        {showHistory && (
          <div style={{ position: 'absolute', inset: '57px 0 0 0', background: C.card, zIndex: 10, display: 'flex', flexDirection: 'column', borderTop: `1px solid ${C.border}` }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Past Conversations</span>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingSessions ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
                  </div>
                </div>
              ) : sessions.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>✦</div>
                  <p style={{ color: C.muted, fontSize: 14 }}>No saved conversations yet.</p>
                  <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Start chatting with Dream and your sessions will appear here.</p>
                </div>
              ) : (
                sessions.map(s => {
                  const isActive = s.id === currentSessionId
                  const date = new Date(s.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={s.id} onClick={() => resumeSession(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', background: isActive ? `${C.accent}12` : 'transparent', transition: 'background 0.15s' }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = `${C.panel}` }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: isActive ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : `${C.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>✦</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? C.accent : C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.title || 'Dream Session'}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{date}</div>
                      </div>
                      {isActive && <span style={{ fontSize: 10, color: C.accent, fontWeight: 700, flexShrink: 0 }}>ACTIVE</span>}
                      <button onClick={e => deleteSession(e, s.id)}
                        title="Delete session"
                        style={{ background: 'none', border: 'none', color: C.muted, fontSize: 14, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, flexShrink: 0, opacity: 0.5 }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = C.red }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = C.muted }}>
                        🗑
                      </button>
                    </div>
                  )
                })
              )}
            </div>
            {sessions.length > 0 && (
              <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                <button onClick={() => { resetChat(); setShowHistory(false) }}
                  style={{ width: '100%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  ✦ Start New Conversation
                </button>
              </div>
            )}
          </div>
        )}
        <div style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 200, maxHeight: 'min(55vh, 400px)' }}>
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
                  <div style={{ padding: '10px 14px', borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: msg.isError ? `${C.red}18` : msg.isLimit ? `${C.gold}12` : isUser ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : C.panel, border: msg.isError ? `1px solid ${C.red}44` : msg.isLimit ? `1px solid ${C.gold}44` : isUser ? 'none' : `1px solid ${C.border}`, fontSize: 13, lineHeight: 1.6, color: msg.isError ? '#FF6B6B' : msg.isLimit ? C.gold : C.text, whiteSpace: 'pre-wrap' }}>
                    {textContent}
                    {msg.isLimit && (
                      <a href="/pricing" style={{ display: 'inline-block', marginTop: 8, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>⬆ Upgrade Plan</a>
                    )}
                    {msg.isError && (
                      <button onClick={() => { setMessages(prev => prev.filter((_, idx) => idx !== i)); send() }}
                        style={{ display: 'block', marginTop: 6, background: 'none', border: `1px solid ${C.red}44`, borderRadius: 6, padding: '3px 10px', color: '#FF6B6B', fontSize: 11, cursor: 'pointer' }}>
                        ↺ Retry
                      </button>
                    )}
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
          <div ref={bottomRef} />
        </div>

        {/* ── Prompt chips — only shown on fresh chat ── */}
        {messages.length === 1 && !loading && (
          <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'nowrap', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            {PROMPT_CHIPS.map(chip => (
              <button key={chip} onClick={() => { setInput(chip.replace(/^[^\s]+\s/, '')); inputRef.current?.focus() }}
                style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, padding: '8px 14px', color: C.muted, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', WebkitTapHighlightColor: 'transparent', minHeight: 36, flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent+'66'; e.currentTarget.style.color = C.text }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}>
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* ── Size / aspect ratio selector ── */}
        <div style={{ padding: '8px 16px 0', display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', borderTop: `1px solid ${C.border}`, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {SIZE_OPTIONS.map(s => (
            <button key={s.id} onClick={() => setAspectRatio(s.id)} title={s.hint}
              style={{ background: aspectRatio === s.id ? `${C.accent}22` : 'none', border: `1px solid ${aspectRatio === s.id ? C.accent+'77' : C.border}`, borderRadius: 8, padding: '4px 10px', color: aspectRatio === s.id ? C.accent : C.muted, fontSize: 11, fontWeight: aspectRatio === s.id ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent' }}>
              {s.label}
            </button>
          ))}
          <span style={{ fontSize: 10, color: C.muted, alignSelf: 'center', marginLeft: 4 }}>
            {SIZE_OPTIONS.find(s => s.id === aspectRatio)?.hint}
          </span>
        </div>
        {(lastAiIndex >= 0 || lastGenerationPromptRef.current) && !loading && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.panel, flexShrink: 0 }}>
            {generatedImages[lastAiIndex] ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <LazyImage src={generatedImages[lastAiIndex]} alt="Generated artwork" width={96} priority style={{ width: 48, height: 48, borderRadius: 8, flexShrink: 0 }} onClick={() => setLightboxImage(generatedImages[lastAiIndex])} />
                {/* Regenerate */}
                <button onClick={() => generatingIndex === null && generateImage(messages[lastAiIndex].content, lastAiIndex)} disabled={generatingIndex !== null}
                  title="Generate again"
                  style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', color: C.muted, fontSize: 12, cursor: generatingIndex !== null ? 'not-allowed' : 'pointer' }}>
                  🔄
                </button>
                {/* Refine */}
                <button onClick={() => refineImage(lastAiIndex)}
                  title="Refine with Dream AI"
                  style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
                  ✏️ Refine
                </button>
                {/* Publish toggle */}
                {autoSavedIds[lastAiIndex] && (
                  <button onClick={() => togglePublish(lastAiIndex)}
                    title={publishedIds.has(autoSavedIds[lastAiIndex]) ? 'Remove from public gallery' : 'Publish to gallery'}
                    style={{ background: publishedIds.has(autoSavedIds[lastAiIndex]) ? `${C.teal}22` : 'none', border: `1px solid ${publishedIds.has(autoSavedIds[lastAiIndex]) ? C.teal + '66' : C.border}`, borderRadius: 8, padding: '6px 10px', color: publishedIds.has(autoSavedIds[lastAiIndex]) ? C.teal : C.muted, fontSize: 12, cursor: 'pointer' }}>
                    {publishedIds.has(autoSavedIds[lastAiIndex]) ? '🌐 Public' : '🔒 Private'}
                  </button>
                )}
                {/* Sell */}
                <button onClick={() => setCreateProductImage(generatedImages[lastAiIndex])}
                  style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: '6px 12px', color: C.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  🛍 Sell
                </button>
                {/* Download */}
                <a href={generatedImages[lastAiIndex]} download="dreamscape-art.png" target="_blank"
                  title="Download"
                  style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', color: C.muted, fontSize: 12, cursor: 'pointer', textDecoration: 'none' }}>
                  ↓
                </a>
                {/* Auto-save indicator */}
                <span style={{ fontSize: 10, color: autoSavedIds[lastAiIndex] ? C.teal : C.muted, marginLeft: 'auto' }}>
                  {autoSavedIds[lastAiIndex] ? '✅ Saved to profile' : '💾 Saving...'}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <GenerateButton pendingPrompt={pendingPrompt} lastGenerationPromptRef={lastGenerationPromptRef} generatingIndex={generatingIndex} messages={messages} setPendingPrompt={setPendingPrompt} generateImage={generateImage} handleSend={send} />
                <button onClick={() => !savedIndexes.has(lastAiIndex) && setSaveTarget({ prompt: messages[lastAiIndex].content, index: lastAiIndex, imageUrl: '' })}
                  style={{ background: 'none', border: `1px solid ${savedIndexes.has(lastAiIndex) ? C.teal + '55' : C.border}`, borderRadius: 8, padding: '8px 14px', color: savedIndexes.has(lastAiIndex) ? C.teal : C.muted, fontSize: 12, cursor: savedIndexes.has(lastAiIndex) ? 'default' : 'pointer' }}>
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
            <input ref={fileInputRef} type="file" accept="image/*,image/heic,image/heif" onChange={handleFileSelect} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()}
              title="Attach reference image"
              style={{ background: referenceImage ? `${C.accent}22` : 'none', border: `1px solid ${referenceImage ? C.accent + '66' : C.border}`, borderRadius: 10, padding: '10px 12px', color: referenceImage ? C.accent : C.muted, fontSize: 16, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>
              📎
            </button>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Describe your vision or ask Dream anything..."
              style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 16, outline: 'none', fontFamily: 'inherit' }}
              autoComplete="off" autoCorrect="off" autoCapitalize="sentences" spellCheck={false} />
            <button onClick={send} disabled={loading || !input.trim()} style={{ background: loading || !input.trim() ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', minWidth: 44, minHeight: 44, WebkitTapHighlightColor: 'transparent' }}>✦</button>
          </div>
        </div>
      </div>
      {saveTarget && <SaveModal prompt={saveTarget.prompt} imageUrl={saveTarget.imageUrl} onSave={handleSave} onClose={() => setSaveTarget(null)} />}
      {lightboxImage && (
        <ImageLightbox
          image={{ src: lightboxImage, alt: `AI generated artwork on Dreamscape`, title: 'Generated Artwork' }}
          onClose={() => setLightboxImage(null)}
          onSell={user ? () => { setCreateProductImage(lightboxImage); setLightboxImage(null) } : null}
        />
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
      </div>{/* close position:relative outer wrapper */}
    </>
  )
}

// ── Shared Image Lightbox ─────────────────────────────────────
function ImageLightbox({ image, onClose, onSell, onDownload, onRefine, onPublishToggle, onDelete, onEdit, isPublic, showActions = true }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    // Prevent body scroll while lightbox open
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const btnStyle = (color = C.muted, bg = 'none') => ({
    background: bg, border: `1px solid ${color}44`, borderRadius: 10,
    padding: isMobile ? '12px 16px' : '10px 18px',
    color, fontSize: isMobile ? 14 : 13, fontWeight: 700,
    cursor: 'pointer', textDecoration: 'none', display: 'inline-flex',
    alignItems: 'center', gap: 6, transition: 'all 0.15s',
    WebkitTapHighlightColor: 'transparent',
  })

  const hasActions = showActions && (onPublishToggle || onEdit || onRefine || onSell || onDelete)

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(8,11,20,0.97)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'center', padding: isMobile ? 0 : 20, cursor: 'zoom-out', overflowY: 'auto' }}>
      <style>{`@keyframes lbIn { from { opacity:0; transform: scale(0.94) } to { opacity:1; transform: scale(1) } }
        @keyframes lbSlide { from { opacity:0; transform: translateY(20px) } to { opacity:1; transform: translateY(0) } }`}</style>

      {/* ── Close button — large, always visible, top of screen on mobile ── */}
      <button onClick={onClose}
        style={{ position: 'fixed', top: isMobile ? 16 : 20, right: isMobile ? 16 : 20, zIndex: 900, background: 'rgba(8,11,20,0.9)', border: `1px solid ${C.border}`, borderRadius: '50%', width: isMobile ? 44 : 36, height: isMobile ? 44 : 36, color: C.text, cursor: 'pointer', fontSize: isMobile ? 20 : 16, display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent', boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
        ✕
      </button>

      <div style={{ position: 'relative', maxWidth: 860, width: '100%', animation: 'lbIn 0.18s ease', padding: isMobile ? '60px 0 0' : 0 }} onClick={e => e.stopPropagation()}>

        {/* Image */}
        <img
          src={image.src}
          alt={image.alt}
          style={{ width: '100%', borderRadius: isMobile ? 0 : 16, boxShadow: isMobile ? 'none' : `0 0 80px ${C.accent}44`, display: 'block', maxHeight: isMobile ? '60vh' : '72vh', objectFit: 'contain', background: C.panel }}
        />

        {/* Caption */}
        {(image.title || image.prompt) && (
          <div style={{ marginTop: 14, textAlign: 'center', padding: isMobile ? '0 20px' : 0 }}>
            {image.title && <div style={{ fontSize: isMobile ? 17 : 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>{image.title}</div>}
            {image.username && <div style={{ fontSize: 13, color: C.accent, marginBottom: 6 }}>@{image.username}</div>}
            {image.prompt && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, maxWidth: 600, margin: '0 auto' }}>{image.prompt.slice(0, 200)}{image.prompt.length > 200 ? '…' : ''}</div>}
          </div>
        )}

        {/* Actions */}
        {hasActions && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap', padding: isMobile ? '0 16px 40px' : 0 }}>
            {onPublishToggle && (
              <button onClick={onPublishToggle} style={btnStyle(isPublic ? C.teal : C.accent, isPublic ? `${C.teal}18` : `${C.accent}18`)}>
                {isPublic ? '🔒 Make Private' : '🌐 Publish'}
              </button>
            )}
            {onEdit && (
              <button onClick={onEdit} style={btnStyle(C.text, C.border)}>
                ✏️ Edit
              </button>
            )}
            {onRefine && (
              <button onClick={onRefine} style={btnStyle(C.muted)}>
                ✏️ Refine
              </button>
            )}
            {onSell && (
              <button onClick={onSell} style={btnStyle('#fff', `linear-gradient(135deg, ${C.accent}, #4B2FD0)`)}>
                🛍 Sell This
              </button>
            )}
            {onDelete && (
              <a href={image.src} download={`${image.title || 'dreamscape-art'}.png`} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                style={btnStyle(C.muted)}>
                ↓ Download
              </a>
            )}
            {onDelete && (
              <button onClick={onDelete} style={btnStyle(C.red)}>
                🗑 Delete
              </button>
            )}
          </div>
        )}

        {/* Tap hint on mobile — only shown when no actions */}
        {!hasActions && isMobile && (
          <div style={{ textAlign: 'center', padding: '12px 0 32px', fontSize: 12, color: C.muted }}>
            Tap anywhere to close
          </div>
        )}
      </div>
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

// ── License Picker Modal ──────────────────────────────────────
// Shown when a creator publishes artwork — they choose how others can use it.
function LicensePickerModal({ art, onConfirm, onClose }) {
  const [license, setLicense] = useState(art.license || 'private')
  const [royaltyPct, setRoyaltyPct] = useState(art.royalty_pct || 15)

  const OPTIONS = [
    {
      id: 'private',
      icon: '🔒',
      label: 'Private Use Only',
      desc: 'Only you can create products from this artwork. Others can view it but cannot use it commercially.',
      color: C.muted,
    },
    {
      id: 'royalty',
      icon: '✦',
      label: 'Open with Royalty',
      desc: 'Anyone can create products using your artwork. You earn a royalty percentage on every sale.',
      color: C.gold,
    },
    {
      id: 'free',
      icon: '🎁',
      label: 'Free Use',
      desc: 'Anyone can use your artwork with no royalty. Great for building your reputation and exposure.',
      color: C.teal,
    },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 650, background: 'rgba(8,11,20,0.94)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className='ds-modal' style={{ background: C.card, borderRadius: 20, width: '100%', maxWidth: 480, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text, marginBottom: 3 }}>Publish Artwork</h3>
          <div style={{ fontSize: 12, color: C.muted }}>Choose how others can use <strong style={{ color: C.text }}>{art.title || 'this artwork'}</strong></div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => setLicense(opt.id)}
              style={{ background: license === opt.id ? `${opt.color}15` : C.bg, border: `2px solid ${license === opt.id ? opt.color + '66' : C.border}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{opt.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: license === opt.id ? opt.color : C.text }}>{opt.label}</span>
                {license === opt.id && <span style={{ marginLeft: 'auto', fontSize: 12, color: opt.color }}>✓ Selected</span>}
              </div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, paddingLeft: 24 }}>{opt.desc}</div>
            </button>
          ))}

          {/* Royalty slider — only shown for royalty option */}
          {license === 'royalty' && (
            <div style={{ background: `${C.gold}10`, border: `1px solid ${C.gold}33`, borderRadius: 12, padding: '14px 16px', marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Your royalty per sale</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: C.gold, fontFamily: 'Playfair Display, serif' }}>{royaltyPct}%</span>
              </div>
              <input type="range" min="5" max="30" value={royaltyPct} onChange={e => setRoyaltyPct(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: C.gold }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: C.muted }}>5% (attract more creators)</span>
                <span style={{ fontSize: 10, color: C.muted }}>30% (maximum)</span>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                On a $35 product: you'd earn ~<strong style={{ color: C.gold }}>${((35 - 12.95 - 35 * 0.029 - 0.30) * (royaltyPct / 100)).toFixed(2)}</strong> per sale as the original artist, automatically.
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm(license, royaltyPct)}
            style={{ flex: 2, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Publish ✦
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Artwork Modal ────────────────────────────────────────
function EditArtworkModal({ art, onSave, onClose }) {
  const [title, setTitle]       = useState(art.title || '')
  const [description, setDesc]  = useState(art.prompt || '')
  const [tags, setTags]         = useState((art.style_tags || []).join(', '))
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return }
    setError(''); setSaving(true)
    const styleTags = tags.split(',').map(t => t.trim()).filter(Boolean)
    const updates = { title: title.trim(), prompt: description.trim(), style_tags: styleTags }
    const { error: dbErr } = await supabase.from('artwork').update(updates).eq('id', art.id)
    if (dbErr) { setError('Failed to save. Please try again.'); setSaving(false); return }
    onSave({ ...art, ...updates })
    onClose()
  }

  const inputStyle = {
    width: '100%', background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(8,11,20,0.95)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, borderRadius: 20, width: '100%', maxWidth: 500, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text, marginBottom: 2 }}>Edit Artwork</h3>
            <div style={{ fontSize: 12, color: C.muted }}>Update title, description and tags</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* Preview */}
        {art.image_url && (
          <div style={{ height: 140, overflow: 'hidden', position: 'relative' }}>
            <LazyImage src={art.image_url} alt={art.title} width={500} priority style={{ width: '100%', height: '100%' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(19,24,38,0.9) 0%, transparent 60%)' }} />
          </div>
        )}

        {/* Fields */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Give your artwork a name..."
              maxLength={100}
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Description <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11 }}>(original prompt)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Describe this artwork..."
              rows={4}
              maxLength={1000}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
            <div style={{ fontSize: 10, color: C.muted, textAlign: 'right', marginTop: 3 }}>{description.length}/1000</div>
          </div>

          {/* Tags */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Style Tags</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="e.g. surrealism, dark, neon, fantasy"
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Comma-separated. Used for discovery.</div>
            {/* Tag preview */}
            {tags.trim() && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {tags.split(',').map(t => t.trim()).filter(Boolean).map((tag, i) => (
                  <span key={i} style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11, color: C.accent }}>{tag}</span>
                ))}
              </div>
            )}
          </div>

          {error && <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '9px 14px', fontSize: 13, color: C.red }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, background: saving ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : '✦ Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Artwork Grid ──────────────────────────────────────────────

// ── Artwork Watermark Overlay ─────────────────────────────────
// Pure CSS overlay — no image manipulation, clean file for product creation
function ArtworkWatermark({ text, style = 'corner', opacity = 40 }) {
  const alpha = opacity / 100
  const wStyle = {
    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
    overflow: 'hidden', borderRadius: 'inherit',
  }

  if (style === 'diagonal') {
    // Repeating diagonal text pattern
    const repeatText = `${text}  ·  ${text}  ·  ${text}  ·  `
    return (
      <div style={wStyle}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{
            position: 'absolute',
            left: '-20%', right: '-20%',
            top: `${i * 22 - 5}%`,
            transform: 'rotate(-25deg)',
            fontSize: 11, fontWeight: 700,
            color: `rgba(255,255,255,${alpha})`,
            textShadow: `0 1px 3px rgba(0,0,0,${alpha * 0.8})`,
            whiteSpace: 'nowrap', letterSpacing: 2,
            fontFamily: "'DM Sans', sans-serif",
            userSelect: 'none',
          }}>
            {repeatText}
          </div>
        ))}
      </div>
    )
  }

  // Corner stamp (default)
  return (
    <div style={wStyle}>
      <div style={{
        position: 'absolute', bottom: 8, right: 8,
        background: `rgba(8,11,20,${alpha * 0.9})`,
        backdropFilter: 'blur(4px)',
        border: `1px solid rgba(255,255,255,${alpha * 0.3})`,
        borderRadius: 6,
        padding: '3px 8px',
        fontSize: 10, fontWeight: 700,
        color: `rgba(255,255,255,${Math.min(alpha + 0.3, 1)})`,
        letterSpacing: 0.5,
        fontFamily: "'DM Sans', sans-serif",
        userSelect: 'none',
        maxWidth: '80%',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {text}
      </div>
    </div>
  )
}

function ArtworkGrid({ artworks, loading, isOwner = false, onSell, onReuse, onPublishToggle, onRefine, onDelete, onEdit }) {
  const navigate = useNavigate()
  const [expanded, setExpanded]   = useState(null)
  const [hover, setHover]         = useState(null)
  const [togglingId, setTogglingId] = useState(null)
  const [lightbox, setLightbox]   = useState(null)
  const [menuOpen, setMenuOpen]   = useState(null) // art.id with open menu
  const [editTarget, setEditTarget] = useState(null) // art object to edit
  const menuRef = useRef(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(null)
    }
    if (menuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  if (loading) return <Spinner cards={6} />
  if (!artworks.length) return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🎨</div>
      <p style={{ color: C.muted, fontSize: 14 }}>No artworks yet.</p>
    </div>
  )

  const handlePublish = async (e, art) => {
    e.stopPropagation()
    setTogglingId(art.id)
    await onPublishToggle?.(art)
    setTogglingId(null)
  }

  const openLightbox = (e, art) => {
    if (!art.image_url) return
    e.stopPropagation()
    // Cmd/Ctrl+Click opens the image directly in a new tab
    if (e.ctrlKey || e.metaKey) {
      window.open(art.image_url, '_blank', 'noopener,noreferrer')
      return
    }
    setLightbox({
      src: art.image_url,
      alt: artAltTag(art),
      title: art.title,
      prompt: art.prompt,
      username: art.profiles?.username,
      art,
    })
  }

  return (
    <>
      {lightbox && (
        <ImageLightbox
          image={lightbox}
          onClose={() => setLightbox(null)}
          isPublic={lightbox.art?.is_public}
          onPublishToggle={isOwner && onPublishToggle ? () => { onPublishToggle(lightbox.art); setLightbox(null) } : null}
          onRefine={isOwner && onRefine ? () => { onRefine(lightbox.art); setLightbox(null) } : null}
          onSell={isOwner && onSell ? () => { onSell(lightbox.art); setLightbox(null) } : null}
          onDelete={isOwner && onDelete ? () => { onDelete(lightbox.art); setLightbox(null) } : null}
          onEdit={isOwner && onEdit ? () => { setEditTarget(lightbox.art); setLightbox(null) } : null}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {artworks.map(art => (
          <div key={art.id}
            className="ds-card"
            style={{ overflow: 'hidden', cursor: 'pointer' }}>
            {/* ── Image area ── */}
            <div style={{ position: 'relative', height: 160, background: `linear-gradient(135deg, ${C.accent}30, ${C.teal}20)`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={(e) => art.image_url ? openLightbox(e, art) : setExpanded(expanded === art.id ? null : art.id)}>
              {art.image_url
                ? <LazyImage src={art.image_url} alt={artAltTag(art)} width={480} style={{ width: '100%', height: '100%' }}
                    onBroken={isOwner ? null : (id) => setArtworks(prev => prev.filter(a => a.id !== id))}
                    resourceId={art.id} resourceType="artwork" />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 40 }}>🎨</div>}

              {/* Watermark overlay — shown on public art when creator has it enabled */}
              {!isOwner && art.is_public && art.profiles?.watermark_enabled && (
                <ArtworkWatermark
                  text={art.profiles.watermark_text || `@${art.profiles.username}`}
                  style={art.profiles.watermark_style || 'corner'}
                  opacity={art.profiles.watermark_opacity || 40}
                />
              )}

              {/* Non-owner ⋯ kebab — always visible, works on mobile */}
              {art.image_url && !isOwner && (
                <div style={{ position: 'absolute', top: 6, right: 6 }} ref={menuOpen === art.id ? menuRef : null}>
                  <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === art.id ? null : art.id) }}
                    style={{ background: 'rgba(8,11,20,0.82)', border: `1px solid ${menuOpen === art.id ? C.accent + '66' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, width: 30, height: 30, color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, transition: 'all 0.15s' }}>
                    ⋯
                  </button>
                  {menuOpen === art.id && (
                    <div style={{ position: 'absolute', top: 36, right: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, minWidth: 160, zIndex: 200, boxShadow: `0 8px 32px rgba(8,11,20,0.9), 0 0 0 1px ${C.accent}22`, overflow: 'hidden' }}
                      onClick={e => e.stopPropagation()}>
                      {[
                        { icon: '🔍', label: 'View Full', color: C.muted, action: (e) => openLightbox(e, art) },
                        ...((art.license === 'royalty' || art.license === 'free') ? [
                          { icon: '🛍', label: 'Use This Art', color: C.accent, action: () => onReuse && onReuse(art) }
                        ] : []),
                      ].map((item, idx, arr) => (
                        <button key={item.label} onClick={(e) => { setMenuOpen(null); item.action(e) }}
                          style={{ width: '100%', background: 'none', border: 'none', borderBottom: idx < arr.length - 1 ? `1px solid ${C.border}` : 'none', padding: '9px 13px', color: item.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 13, flexShrink: 0 }}>{item.icon}</span>{item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Public/private + license badge — top left */}
              <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4, pointerEvents: 'none' }}>
                <div style={{ background: 'rgba(8,11,20,0.82)', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: art.is_public ? C.teal : C.muted }}>
                  {art.is_public ? '🌐 Public' : '🔒 Private'}
                </div>
                {art.is_public && art.license && art.license !== 'private' && (
                  <div style={{ background: 'rgba(8,11,20,0.82)', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: art.license === 'royalty' ? C.gold : C.teal }}>
                    {art.license === 'royalty' ? `✦ ${art.royalty_pct || 15}%` : '🎁'}
                  </div>
                )}
              </div>

              {/* ⋯ Kebab menu button — top right, owner only */}
              {isOwner && (
                <div style={{ position: 'absolute', top: 6, right: 6 }} ref={menuOpen === art.id ? menuRef : null}>
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === art.id ? null : art.id) }}
                    style={{ background: 'rgba(8,11,20,0.82)', border: `1px solid ${menuOpen === art.id ? C.accent + '66' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, width: 30, height: 30, color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, transition: 'all 0.15s' }}>
                    ⋯
                  </button>

                  {/* Dropdown menu */}
                  {menuOpen === art.id && (
                    <div style={{ position: 'absolute', top: 36, right: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, minWidth: 170, zIndex: 50, boxShadow: `0 8px 32px rgba(8,11,20,0.6), 0 0 0 1px ${C.accent}22`, overflow: 'hidden' }}
                      onClick={e => e.stopPropagation()}>

                      {/* Edit Details */}
                      <button onClick={() => { setMenuOpen(null); setEditTarget(art) }}
                        style={{ width: '100%', background: 'none', border: 'none', borderBottom: `1px solid ${C.border}`, padding: '10px 14px', color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span>✏️</span> Edit Details
                      </button>

                      {/* Publish toggle */}
                      <button onClick={async (e) => { setMenuOpen(null); await handlePublish(e, art) }}
                        disabled={togglingId === art.id}
                        style={{ width: '100%', background: 'none', border: 'none', borderBottom: `1px solid ${C.border}`, padding: '10px 14px', color: art.is_public ? C.teal : C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span>{art.is_public ? '🔒' : '🌐'}</span> {togglingId === art.id ? 'Working...' : art.is_public ? 'Make Private' : 'Publish'}
                      </button>

                      {/* Refine */}
                      <button onClick={() => { setMenuOpen(null); onRefine && onRefine(art) }}
                        style={{ width: '100%', background: 'none', border: 'none', borderBottom: `1px solid ${C.border}`, padding: '10px 14px', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span>✨</span> Refine in Dream
                      </button>

                      {/* Sell */}
                      <button onClick={() => { setMenuOpen(null); onSell && onSell(art) }}
                        style={{ width: '100%', background: 'none', border: 'none', borderBottom: `1px solid ${C.border}`, padding: '10px 14px', color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span>🛍</span> Sell This
                      </button>

                      {/* Delete */}
                      {onDelete && (
                        <button onClick={() => { setMenuOpen(null); onDelete(art) }}
                          style={{ width: '100%', background: 'none', border: 'none', borderTop: `1px solid ${C.border}`, padding: '10px 14px', color: C.red, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, WebkitAppearance: 'none', appearance: 'none' }}>
                          <span>🗑</span> Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Card footer ── */}
            <div style={{ padding: '12px 14px' }}>
              {/* Broken image warning — owner only */}
              {isOwner && art.broken_image && (
                <div style={{ background: `${C.red}12`, border: `1px solid ${C.red}33`, borderRadius: 8, padding: '6px 10px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12 }}>⚠️</span>
                  <span style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>Image unavailable — please fix or delete</span>
                </div>
              )}
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{art.title || 'Untitled'}</div>
              {art.profiles?.username && (
                <div onClick={e => { e.stopPropagation(); navOrNewTab(e, `/u/${art.profiles.username}`, navigate) }}
                  style={{ fontSize: 11, color: C.accent, marginBottom: 4, cursor: 'pointer' }}>@{art.profiles.username}</div>
              )}
              {art.style_tags?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {art.style_tags.slice(0, 3).map(tag => (
                    <span key={tag} style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}33`, borderRadius: 20, padding: '1px 8px', fontSize: 10, color: C.accent }}>{tag}</span>
                  ))}
                  {art.style_tags.length > 3 && <span style={{ fontSize: 10, color: C.muted, alignSelf: 'center' }}>+{art.style_tags.length - 3}</span>}
                </div>
              )}
              <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>{new Date(art.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
          </div>
        ))}
        </div>

        {/* Edit artwork modal */}
        {editTarget && (
          <EditArtworkModal
            art={editTarget}
            onSave={(updated) => { onEdit && onEdit(updated); setEditTarget(null) }}
            onClose={() => setEditTarget(null)}
          />
        )}
    </>
  )
}

// ── Onboarding Modal ──────────────────────────────────────────
function OnboardingModal({ user, onClose }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  const STEPS = [
    {
      icon: '✦',
      title: 'Welcome to Dreamscape!',
      body: "You're now part of a creative community turning AI art into real products. Here's how to get started in 3 steps.",
      action: 'Let\'s go →',
      onAction: () => setStep(1),
    },
    {
      icon: '🎨',
      title: 'Step 1 — Create your first artwork',
      body: 'Head to the Create page, describe your vision to Dream AI, and generate your first image. It only takes a few seconds.',
      action: 'Open Dream AI →',
      onAction: () => { onClose(); navigate('/create') },
      skip: () => setStep(2),
    },
    {
      icon: '🛍',
      title: 'Step 2 — Turn it into a product',
      body: "Once you've generated an image you love, hit Sell This to put it on a t-shirt, mug, poster, or more. Printful handles printing and shipping.",
      action: 'Got it →',
      onAction: () => setStep(3),
      skip: () => setStep(3),
    },
    {
      icon: '💸',
      title: 'Step 3 — Connect your bank & earn',
      body: 'Go to your Profile → Payouts and connect Stripe to receive earnings directly. Every sale you make deposits straight to your account.',
      action: 'Set Up Payouts →',
      onAction: () => { onClose(); navigate('/profile') },
      skip: () => onClose(),
    },
  ]

  const s = STEPS[step]

  const dismiss = () => {
    localStorage.setItem(`ds_onboarded_${user.id}`, '1')
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9200, background: 'rgba(8,11,20,0.92)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: `0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px ${C.accent}22` }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '20px 24px 0' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, background: i === step ? C.accent : i < step ? C.teal : C.border, transition: 'all 0.3s' }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '28px 32px 24px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}33, ${C.teal}22)`, border: `2px solid ${C.accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 20px' }}>
            {s.icon}
          </div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 12, lineHeight: 1.3 }}>{s.title}</h2>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 28 }}>{s.body}</p>

          <button onClick={s.onAction}
            style={{ width: '100%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 12, padding: '13px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
            {s.action}
          </button>
          {s.skip && (
            <button onClick={s.skip}
              style={{ background: 'none', border: 'none', color: C.muted, fontSize: 13, cursor: 'pointer', padding: '4px' }}>
              Skip for now
            </button>
          )}
        </div>

        {/* Dismiss */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 24px', textAlign: 'center' }}>
          <button onClick={dismiss} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
            Don't show this again
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Age Gate ──────────────────────────────────────────────────
const AGE_KEY = 'ds_age_verified'

function useAgeGate() {
  const [gateState, setGateState] = useState(() => {
    try { return localStorage.getItem(AGE_KEY) || null } catch { return null }
  })
  const pass = (dob) => {
    try { localStorage.setItem(AGE_KEY, dob) } catch {}
    setGateState(dob)
  }
  const isVerified = gateState && gateState !== 'blocked_u13' && gateState !== 'blocked_u18'
  const isBlockedU13 = gateState === 'blocked_u13'
  const isBlockedU18 = gateState === 'blocked_u18'
  return { isVerified, isBlockedU13, isBlockedU18, pass, gateState }
}

function AgeGate({ onPass }) {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [year, setYear] = useState('')
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(null) // null | 'u13' | 'u18'

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i)
  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  const handleConfirm = () => {
    setError('')
    if (!month || !day || !year) { setError('Please enter your full date of birth.'); return }
    const dob = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    if (isNaN(dob.getTime())) { setError('Please enter a valid date.'); return }
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const m = today.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
    if (age < 0 || age > 120) { setError('Please enter a valid date of birth.'); return }

    const dobStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    if (age < 13) {
      try { localStorage.setItem(AGE_KEY, 'blocked_u13') } catch {}
      setBlocked('u13')
    } else if (age < 18) {
      try { localStorage.setItem(AGE_KEY, 'blocked_u18') } catch {}
      setBlocked('u18')
    } else {
      onPass(dobStr)
    }
  }

  const sel = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 14px', color: month || day || year ? C.text : C.muted, fontSize: 14, outline: 'none', fontFamily: 'inherit', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }

  if (blocked === 'u13') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🎨</div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, color: C.text, marginBottom: 12 }}>Come Back Soon!</h2>
        <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
          Dreamscape is for artists aged 13 and over. We can't wait to see what you create when you're older! 🌟
        </p>
      </div>
    </div>
  )

  if (blocked === 'u18') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>✦</div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, color: C.text, marginBottom: 12 }}>Almost There!</h2>
        <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
          Dreamscape is currently available to artists 18 and over. We're working on a version for younger creators — check back on your 18th birthday! 🎂
        </p>
        <p style={{ color: C.muted, fontSize: 12 }}>
          In the meantime, explore AI art at <a href="https://google.com" style={{ color: C.accent }}>Google's Arts & Culture</a>.
        </p>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(8,11,20,0.98)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <StarField />
      <div style={{ position: 'relative', zIndex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: '40px 36px', maxWidth: 440, width: '100%', textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff', margin: '0 auto 20px' }}>✦</div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: C.text, marginBottom: 8 }}>
          Welcome to <span style={{ color: C.accent }}>Dream</span>scape
        </h1>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
          To continue, please enter your date of birth.<br />
          <span style={{ fontSize: 12 }}>Dreamscape is for users aged 18 and over.</span>
        </p>

        {/* DOB dropdowns */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: 10, marginBottom: 20 }}>
          <select value={month} onChange={e => setMonth(e.target.value)} style={sel}>
            <option value="" disabled>Month</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={day} onChange={e => setDay(e.target.value)} style={sel}>
            <option value="" disabled>Day</option>
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={year} onChange={e => setYear(e.target.value)} style={sel}>
            <option value="" disabled>Year</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {error && (
          <div style={{ background: '#ff6b6b18', border: '1px solid #ff6b6b44', borderRadius: 8, padding: '9px 14px', marginBottom: 16, fontSize: 13, color: '#ff6b6b' }}>
            {error}
          </div>
        )}

        <button onClick={handleConfirm}
          style={{ width: '100%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 12, padding: '14px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
          Continue ✦
        </button>

        <p style={{ color: C.muted, fontSize: 11, lineHeight: 1.6 }}>
          By continuing you confirm you are 18+ and agree to our{' '}
          <a href="/terms" style={{ color: C.accent }}>Terms of Service</a> and{' '}
          <a href="/privacy" style={{ color: C.accent }}>Privacy Policy</a>.
          Your date of birth is used only for age verification and is never shared.
          <br /><br />
          <span style={{ color: '#ff6b6b88' }}>
            ⚠️ Providing a false date of birth to circumvent this age gate is a violation of our Terms of Service and misrepresentation of age to access an adult platform. Dreamscape is not liable for any access obtained through false information.
          </span>
        </p>
      </div>
    </div>
  )
}

// ── Image Crop / Pan / Zoom Editor ───────────────────────────
function ImageCropEditor({ src, aspectRatio, onConfirm, onCancel, shape = 'rect' }) {
  // aspectRatio: e.g. 1 for avatar (square), 3 for banner (3:1)
  const canvasRef = useRef(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const imgRef = useRef(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  const CANVAS_W = 480
  const CANVAS_H = Math.round(CANVAS_W / aspectRatio)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; setImgLoaded(true) }
    img.src = src
  }, [src])

  useEffect(() => {
    if (!imgLoaded) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

    const img = imgRef.current
    const scale = Math.max(CANVAS_W / img.width, CANVAS_H / img.height) * zoom
    const drawW = img.width * scale
    const drawH = img.height * scale
    const x = (CANVAS_W - drawW) / 2 + offset.x
    const y = (CANVAS_H - drawH) / 2 + offset.y

    ctx.drawImage(img, x, y, drawW, drawH)

    // Dim outside the crop circle for avatars
    if (shape === 'circle') {
      ctx.save()
      ctx.fillStyle = 'rgba(8,11,20,0.6)'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      const r = Math.min(CANVAS_W, CANVAS_H) / 2 - 4
      ctx.arc(CANVAS_W / 2, CANVAS_H / 2, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      // Circle guide border
      ctx.strokeStyle = C.accent
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.arc(CANVAS_W / 2, CANVAS_H / 2, Math.min(CANVAS_W, CANVAS_H) / 2 - 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    } else {
      // Banner guide border
      ctx.strokeStyle = C.accent
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(2, 2, CANVAS_W - 4, CANVAS_H - 4)
      ctx.setLineDash([])
    }
  }, [imgLoaded, offset, zoom, shape])

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  const onMouseDown = (e) => { e.preventDefault(); setDragging(true); setDragStart(getPos(e)) }
  const onMouseMove = (e) => {
    if (!dragging || !dragStart) return
    e.preventDefault()
    const pos = getPos(e)
    setOffset(prev => ({ x: prev.x + (pos.x - dragStart.x), y: prev.y + (pos.y - dragStart.y) }))
    setDragStart(pos)
  }
  const onMouseUp = () => { setDragging(false); setDragStart(null) }

  const onWheel = (e) => {
    e.preventDefault()
    setZoom(z => Math.max(0.5, Math.min(4, z - e.deltaY * 0.001)))
  }

  const handleConfirm = () => {
    const canvas = canvasRef.current
    canvas.toBlob(blob => onConfirm(blob), 'image/jpeg', 0.92)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(8,11,20,0.97)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '24px', maxWidth: 540, width: '100%' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          {shape === 'circle' ? '📸 Crop Profile Picture' : '🖼 Crop Banner Image'}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
          Drag to reposition · Scroll or use slider to zoom · {shape === 'circle' ? 'Circle shows what visitors see' : 'Rectangle shows what visitors see'}
        </div>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onMouseDown}
          onTouchMove={onMouseMove}
          onTouchEnd={onMouseUp}
          onWheel={onWheel}
          style={{ width: '100%', height: 'auto', borderRadius: 12, cursor: dragging ? 'grabbing' : 'grab', display: 'block', background: C.bg, border: `1px solid ${C.border}` }}
        />

        {/* Zoom slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <span style={{ fontSize: 12, color: C.muted }}>🔍</span>
          <input type="range" min="50" max="300" value={Math.round(zoom * 100)}
            onChange={e => setZoom(parseInt(e.target.value) / 100)}
            style={{ flex: 1, accentColor: C.accent }} />
          <span style={{ fontSize: 12, color: C.text, minWidth: 36 }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }) }}
            style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>
            Reset
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onCancel} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleConfirm} style={{ flex: 2, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Use This ✦
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Profile Modal ────────────────────────────────────────
function EditProfileModal({ user, profile, onClose, onSave }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [usernameStatus, setUsernameStatus] = useState('unchanged') // 'unchanged' | 'checking' | 'available' | 'taken' | 'invalid'
  const usernameCheckRef = useRef(null)
  const [bio, setBio] = useState(profile?.bio || '')
  const [location, setLocation] = useState(profile?.location || '')
  const [website, setWebsite] = useState(profile?.website || '')
  const [artistStatement, setArtistStatement] = useState(profile?.artist_statement || '')
  const [styleTags, setStyleTags] = useState((profile?.style_tags || []).join(', '))
  const [dob, setDob] = useState(profile?.date_of_birth || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null)
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(profile?.banner_url || null)
  const [brandName, setBrandName] = useState(profile?.brand_name || '')
  const [brandTagline, setBrandTagline] = useState(profile?.brand_tagline || '')
  const [brandColor, setBrandColor] = useState(profile?.brand_color || '#7C5CFC')
  const [storefrontActive, setStorefrontActive] = useState(profile?.storefront_active || false)
  const [emailNotifications, setEmailNotifications] = useState(profile?.email_notifications !== false)
  const [customDomain, setCustomDomain] = useState(profile?.custom_domain || '')
  const [watermarkEnabled, setWatermarkEnabled] = useState(profile?.watermark_enabled || false)
  const [watermarkText, setWatermarkText] = useState(profile?.watermark_text || '')
  const [watermarkStyle, setWatermarkStyle] = useState(profile?.watermark_style || 'corner')
  const [watermarkOpacity, setWatermarkOpacity] = useState(profile?.watermark_opacity || 40)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isBizTier = ['merchant', 'brand', 'enterprise'].includes(profile?.subscription_tier)
  const [activeSection, setActiveSection] = useState('basic')
  const avatarRef = useRef(null)
  const bannerRef = useRef(null)
  const [cropSrc, setCropSrc] = useState(null)     // raw src waiting to be cropped
  const [cropType, setCropType] = useState(null)   // 'avatar' | 'banner'

  const handleImageSelect = (file, type) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => { setCropSrc(e.target.result); setCropType(type) }
    reader.readAsDataURL(file)
  }

  const handleCropConfirm = (blob) => {
    const url = URL.createObjectURL(blob)
    if (cropType === 'avatar') {
      setAvatarPreview(url)
      setAvatarFile(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
    } else {
      setBannerPreview(url)
      setBannerFile(new File([blob], 'banner.jpg', { type: 'image/jpeg' }))
    }
    setCropSrc(null); setCropType(null)
  }

  const handleUsernameChange = (val) => {
    // Sanitise: lowercase, alphanumeric + underscore + hyphen only
    const clean = val.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30)
    setUsername(clean)

    // No check needed if unchanged
    if (clean === profile?.username) { setUsernameStatus('unchanged'); return }

    // Validate format: 3-30 chars, letters/numbers/underscore/hyphen
    if (clean.length < 3 || !/^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/.test(clean)) {
      setUsernameStatus('invalid'); return
    }

    // Debounced availability check
    setUsernameStatus('checking')
    clearTimeout(usernameCheckRef.current)
    usernameCheckRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', clean)
        .neq('id', user.id) // exclude self
        .maybeSingle()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 500)
  }

  const uploadImage = async (file, bucket, pathPrefix) => {
    const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
    const path = `${pathPrefix}.${ext}`
    console.log(`Uploading to ${bucket}/${path}`, file.type, file.size)
    await supabase.storage.from(bucket).remove([path])
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type })
    if (error) { console.error('Upload error:', error); throw error }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
    const url = `${publicUrl}?t=${Date.now()}`
    console.log('Upload success, URL:', url)
    return url
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    // Block save if username is in a bad state
    if (usernameStatus === 'taken') { setError('That username is already taken. Please choose another.'); setSaving(false); return }
    if (usernameStatus === 'invalid') { setError('Username must be 3–30 characters and only contain letters, numbers, underscores, or hyphens.'); setSaving(false); return }
    if (usernameStatus === 'checking') { setError('Still checking username availability — please wait a moment.'); setSaving(false); return }
    // If username changed, do a final availability check before committing
    if (usernameStatus === 'available') {
      const { data: conflict } = await supabase.from('profiles').select('id').eq('username', username).neq('id', user.id).maybeSingle()
      if (conflict) { setError('That username was just taken. Please choose another.'); setSaving(false); return }
    }
    try {
      let avatarUrl = profile?.avatar_url || null
      let bannerUrl = profile?.banner_url || null
      if (avatarFile) avatarUrl = await uploadImage(avatarFile, 'avatars', `${user.id}/avatar`)
      if (bannerFile) bannerUrl = await uploadImage(bannerFile, 'banners', `${user.id}/banner`)
      const tags = styleTags.split(',').map(t => t.trim()).filter(Boolean)
      const updates = {
        id: user.id,
        username: username || profile?.username,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
        artist_statement: artistStatement.trim() || null,
        style_tags: tags,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        date_of_birth: dob || null,
        brand_name: brandName.trim() || null,
        brand_tagline: brandTagline.trim() || null,
        brand_color: brandColor || '#7C5CFC',
        storefront_active: storefrontActive,
        email_notifications: emailNotifications,
        custom_domain: customDomain.trim().toLowerCase().replace(/^https?:\/\//, '') || null,
        watermark_enabled: watermarkEnabled,
        watermark_text: watermarkText.trim() || null,
        watermark_style: watermarkStyle,
        watermark_opacity: watermarkOpacity,
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

  const sections = [...[['basic', '👤 Basic'], ['artist', '🎨 Artist'], ['images', '🖼 Images']], ...(isBizTier ? [['brand', '🏢 Brand']] : [])]

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

              {/* Username */}
              <div>
                <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                  Username
                  {/* Live status indicator */}
                  {usernameStatus === 'unchanged' && <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>current: @{profile?.username}</span>}
                  {usernameStatus === 'checking'  && <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>⏳ Checking...</span>}
                  {usernameStatus === 'available' && <span style={{ fontSize: 11, color: C.teal, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>✅ Available</span>}
                  {usernameStatus === 'taken'     && <span style={{ fontSize: 11, color: C.red, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>❌ Taken</span>}
                  {usernameStatus === 'invalid'   && <span style={{ fontSize: 11, color: C.gold, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>⚠️ 3–30 chars, letters/numbers/_/-</span>}
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }}>@</span>
                  <input
                    value={username}
                    onChange={e => handleUsernameChange(e.target.value)}
                    placeholder={profile?.username || 'yourhandle'}
                    maxLength={30}
                    style={{
                      ...inputStyle,
                      paddingLeft: 28,
                      borderColor: usernameStatus === 'taken'     ? C.red + '88'
                                 : usernameStatus === 'available' ? C.teal + '88'
                                 : usernameStatus === 'invalid'   ? C.gold + '88'
                                 : C.border,
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                  Your public profile lives at trydreamscape.com/u/<strong style={{ color: C.accent }}>{username || profile?.username}</strong>. Changing it frees up your old handle for others.
                </div>
              </div>

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
                <label style={labelStyle}>Date of Birth <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(private — used for age compliance)</span></label>
                <input type="date" value={dob} onChange={e => setDob(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'dark' }} />
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>🔒 Never shared or displayed publicly.</div>
              </div>
              <div>
                <label style={labelStyle}>Website / Social Link</label>
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yoursite.com" maxLength={200} style={inputStyle} />
              </div>
              {/* Email notification preference */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Email Notifications</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Sales, payouts, new followers</div>
                </div>
                <button onClick={() => setEmailNotifications(v => !v)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: emailNotifications ? C.teal : C.border, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 4, left: emailNotifications ? 22 : 4, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
                </button>
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

              {/* ── Watermark Settings ── */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                <label style={labelStyle}>Watermark</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Show watermark on public artwork</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Adds your credit on images viewed in Gallery and profiles</div>
                  </div>
                  <button onClick={() => setWatermarkEnabled(v => !v)}
                    style={{ width: 44, height: 24, borderRadius: 12, background: watermarkEnabled ? C.accent : C.border, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 4, left: watermarkEnabled ? 22 : 4, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
                  </button>
                </div>

                {watermarkEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Custom text */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Watermark Text</div>
                      <input value={watermarkText} onChange={e => setWatermarkText(e.target.value)}
                        placeholder={`@${profile?.username || 'username'} · Dreamscape`}
                        maxLength={60} style={inputStyle} />
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Leave blank to use @{profile?.username}</div>
                    </div>

                    {/* Style */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Style</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[['corner','📍 Corner stamp'],['diagonal','🔄 Diagonal repeat']].map(([val, label]) => (
                          <button key={val} onClick={() => setWatermarkStyle(val)}
                            style={{ flex: 1, background: watermarkStyle === val ? `${C.accent}20` : 'none', border: `1px solid ${watermarkStyle === val ? C.accent+'55' : C.border}`, borderRadius: 8, padding: '8px', color: watermarkStyle === val ? C.accent : C.muted, fontSize: 12, fontWeight: watermarkStyle === val ? 700 : 400, cursor: 'pointer' }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Opacity */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        Opacity — {watermarkOpacity}%
                      </div>
                      <input type="range" min={10} max={80} step={5} value={watermarkOpacity} onChange={e => setWatermarkOpacity(Number(e.target.value))}
                        style={{ width: '100%', accentColor: C.accent }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.muted, marginTop: 2 }}>
                        <span>Subtle</span><span>Strong</span>
                      </div>
                    </div>

                    {/* Live preview */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Preview</div>
                      <div style={{ position: 'relative', height: 120, background: `linear-gradient(135deg, ${C.accent}22, ${C.teal}22)`, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                        {/* Fake artwork background */}
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, opacity: 0.3 }}>🎨</div>
                        {/* Watermark overlay preview */}
                        <ArtworkWatermark
                          text={watermarkText.trim() || `@${profile?.username || 'username'}`}
                          style={watermarkStyle}
                          opacity={watermarkOpacity}
                        />
                      </div>
                    </div>
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
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: avatarPreview ? 'transparent' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: `2px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {avatarPreview ? <img src={avatarPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 28, color: '#fff' }}>{profile?.username?.[0]?.toUpperCase() || '?'}</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={() => avatarRef.current?.click()} style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: '7px 16px', color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Upload Photo</button>
                    {avatarPreview && (
                      <button onClick={() => { setCropSrc(avatarPreview); setCropType('avatar') }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 16px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>✂️ Re-crop</button>
                    )}
                    <div style={{ fontSize: 11, color: C.muted }}>Square works best.</div>
                  </div>
                </div>
                <input ref={avatarRef} type="file" accept="image/*" onChange={e => { handleImageSelect(e.target.files?.[0], 'avatar'); e.target.value = '' }} style={{ display: 'none' }} />
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
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => bannerRef.current?.click()} style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: '6px 14px', color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Upload Banner</button>
                  {bannerPreview && (
                    <button onClick={() => { setCropSrc(bannerPreview); setCropType('banner') }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>✂️ Re-crop</button>
                  )}
                </div>
                <input ref={bannerRef} type="file" accept="image/*" onChange={e => { handleImageSelect(e.target.files?.[0], 'banner'); e.target.value = '' }} style={{ display: 'none' }} />
                <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>💡 Recommended: <span style={{ color: C.text }}>1500×500px</span> (3:1 ratio). The center shows best on all screens.</div>
              </div>
            </div>
          )}

          {/* Brand section — business tiers only */}
          {activeSection === 'brand' && isBizTier && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: `rgba(255,107,74,0.08)`, border: `1px solid rgba(255,107,74,0.25)`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#FF6B4A' }}>
                🏢 Brand Storefront — your public shop page at <strong>trydreamscape.com/u/{profile?.username}</strong> will display your brand identity instead of the standard artist layout.
              </div>

              {/* Storefront toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Enable Brand Storefront</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Show brand layout to visitors instead of standard profile</div>
                </div>
                <button onClick={() => setStorefrontActive(a => !a)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: storefrontActive ? '#FF6B4A' : C.border, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 4, left: storefrontActive ? 22 : 4, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
                </button>
              </div>

              {/* Brand name */}
              <div>
                <label style={labelStyle}>Brand Name</label>
                <input value={brandName} onChange={e => setBrandName(e.target.value)}
                  placeholder="e.g. Acme Merch Co."
                  maxLength={60}
                  style={inputStyle} />
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Displayed prominently on your storefront. Defaults to your display name if left blank.</div>
              </div>

              {/* Tagline */}
              <div>
                <label style={labelStyle}>Tagline</label>
                <input value={brandTagline} onChange={e => setBrandTagline(e.target.value)}
                  placeholder="e.g. Premium art-driven merchandise"
                  maxLength={100}
                  style={inputStyle} />
              </div>

              {/* Brand color */}
              <div>
                <label style={labelStyle}>Brand Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)}
                    style={{ width: 48, height: 48, borderRadius: 10, border: `1px solid ${C.border}`, background: 'none', cursor: 'pointer', padding: 2 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{brandColor}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Used for storefront accents, buttons and borders</div>
                  </div>
                  <div style={{ marginLeft: 'auto', background: `${brandColor}18`, border: `2px solid ${brandColor}66`, borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: brandColor }}>
                    Preview
                  </div>
                </div>
              </div>

              {/* Custom domain — Brand/Enterprise only */}
              {['brand', 'enterprise'].includes(profile?.subscription_tier) && (
                <div>
                  <label style={labelStyle}>Custom Domain <span style={{ color: C.gold, fontWeight: 700, fontSize: 10 }}>Brand+</span></label>
                  <input value={customDomain} onChange={e => setCustomDomain(e.target.value)}
                    placeholder="shop.yourcompany.com"
                    style={inputStyle} />
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>
                    Point a CNAME record from your domain to <span style={{ color: C.text, fontFamily: 'monospace' }}>trydreamscape.com</span>, then enter it here. Verification can take up to 48 hours.
                  </div>
                  {profile?.custom_domain && (
                    <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: profile.custom_domain_verified ? `${C.teal}15` : `${C.gold}15`, border: `1px solid ${profile.custom_domain_verified ? C.teal+'44' : C.gold+'44'}`, borderRadius: 8, padding: '4px 10px', fontSize: 11, color: profile.custom_domain_verified ? C.teal : C.gold }}>
                      {profile.custom_domain_verified ? '✅ Verified' : '⏳ Pending verification'} — {profile.custom_domain}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {error && <div style={{ margin: '0 24px', background: '#ff6b6b18', border: '1px solid #ff6b6b44', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ff6b6b', flexShrink: 0 }}>{error}</div>}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave}
            disabled={saving || usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking'}
            style={{ flex: 2, background: (saving || usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking') ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: (saving || usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking') ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : usernameStatus === 'taken' ? '❌ Username Taken' : usernameStatus === 'checking' ? '⏳ Checking...' : 'Save Profile ✦'}
          </button>
        </div>
      </div>

      {/* Crop editor — position:fixed so renders above everything, outside modal container */}
      {cropSrc && (
        <ImageCropEditor
          src={cropSrc}
          aspectRatio={cropType === 'avatar' ? 1 : 3}
          shape={cropType === 'avatar' ? 'circle' : 'rect'}
          onConfirm={handleCropConfirm}
          onCancel={() => { setCropSrc(null); setCropType(null) }}
        />
      )}
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

// ── Follow List Modal ─────────────────────────────────────────
function FollowListModal({ type, profileId, viewerUser, onClose }) {
  // type: 'followers' | 'following'
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [followingIds, setFollowingIds] = useState(new Set())
  const [togglingId, setTogglingId] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    let data
    if (type === 'followers') {
      // People who follow this profile
      const { data: rows } = await supabase
        .from('follows')
        .select('follower_id, profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, bio)')
        .eq('following_id', profileId)
      data = rows?.map(r => r.profiles).filter(Boolean) || []
    } else {
      // People this profile follows
      const { data: rows } = await supabase
        .from('follows')
        .select('following_id, profiles!follows_following_id_fkey(id, username, display_name, avatar_url, bio)')
        .eq('follower_id', profileId)
      data = rows?.map(r => r.profiles).filter(Boolean) || []
    }
    setUsers(data)

    // Load viewer's current following list for follow buttons
    if (viewerUser) {
      const { data: myFollows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', viewerUser.id)
      setFollowingIds(new Set(myFollows?.map(f => f.following_id) || []))
    }
    setLoading(false)
  }

  const toggleFollow = async (targetId) => {
    if (!viewerUser || targetId === viewerUser.id) return
    setTogglingId(targetId)
    const isFollowing = followingIds.has(targetId)
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', viewerUser.id).eq('following_id', targetId)
      setFollowingIds(prev => { const n = new Set(prev); n.delete(targetId); return n })
    } else {
      await supabase.from('follows').insert({ follower_id: viewerUser.id, following_id: targetId })
      setFollowingIds(prev => new Set([...prev, targetId]))
      // Fire follow notification in background (email + in-app)
      getAuthHeader().then(h => fetch('/api/notify-follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ targetUserId: targetId }),
      }).catch(() => {}))
    }
    setTogglingId(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(8,11,20,0.92)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 460, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text }}>
            {type === 'followers' ? '👥 Followers' : '✦ Following'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
              </div>
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✦</div>
              <p style={{ color: C.muted, fontSize: 14 }}>
                {type === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
              </p>
            </div>
          ) : (
            users.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderBottom: `1px solid ${C.border}` }}>
                {/* Avatar */}
                <div
                  onClick={e => { if (e.ctrlKey || e.metaKey) { window.open(`/u/${u.username}`, '_blank', 'noopener,noreferrer') } else { navigate(`/u/${u.username}`); onClose() } }}
                  style={{ width: 44, height: 44, borderRadius: '50%', background: u.avatar_url ? 'transparent' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                  {u.avatar_url
                    ? <LazyImage src={u.avatar_url} alt={u.username} width={80} style={{ width: '100%', height: '100%' }} />
                    : u.username?.[0]?.toUpperCase()}
                </div>
                {/* Info */}
                <div onClick={e => { if (e.ctrlKey || e.metaKey) { window.open(`/u/${u.username}`, '_blank', 'noopener,noreferrer') } else { navigate(`/u/${u.username}`); onClose() } }} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.display_name || u.username}
                  </div>
                  <div style={{ fontSize: 12, color: C.accent }}>@{u.username}</div>
                </div>
                {/* Follow button — only show if viewer is logged in and it's not themselves */}
                {viewerUser && u.id !== viewerUser.id && (
                  <button
                    onClick={() => toggleFollow(u.id)}
                    disabled={togglingId === u.id}
                    style={{
                      background: followingIds.has(u.id) ? 'none' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`,
                      border: `1px solid ${followingIds.has(u.id) ? C.border : 'transparent'}`,
                      borderRadius: 8, padding: '6px 14px',
                      color: followingIds.has(u.id) ? C.muted : '#fff',
                      fontSize: 12, fontWeight: 600,
                      cursor: togglingId === u.id ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                    }}>
                    {togglingId === u.id ? '...' : followingIds.has(u.id) ? 'Following ✓' : '+ Follow'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Profile Header (shared by ProfilePage + ArtistProfilePage) ─
function ProfileHeader({ profile, artworkCount, followerCount, followingCount, salesCount, isOwnProfile, viewerUser, onEdit, onFollow, followLoading, isFollowing, onStatClick }) {
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
          {profile?.display_name && <div className='ds-heading-glow' style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 2 }}>{profile.display_name}</div>}
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
          {[
            { count: artworkCount,   label: 'Artworks',  key: 'artwork',   clickable: true },
            { count: followerCount,  label: 'Followers', key: 'followers', clickable: true },
            { count: followingCount, label: 'Following', key: 'following', clickable: true },
            { count: salesCount,     label: 'Sales',     key: 'shop',      clickable: isOwnProfile },
          ].map(({ count, label, key, clickable }) => (
            <div key={label}
              onClick={() => clickable && onStatClick?.(key)}
              style={{ cursor: clickable && onStatClick ? 'pointer' : 'default', transition: 'opacity 0.15s' }}
              onMouseEnter={e => { if (clickable && onStatClick) e.currentTarget.style.opacity = '0.7' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: clickable && onStatClick ? C.accent : C.text, fontFamily: 'Playfair Display, serif' }}>{count ?? '—'}</div>
              <div style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 3 }}>
                {label}
                {clickable && onStatClick && <span style={{ fontSize: 9, color: C.accent }}>↗</span>}
              </div>
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

// ── Edit Product Modal ────────────────────────────────────────
function EditProductModal({ product, user, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(product.title || '')
  const [description, setDescription] = useState(product.description || '')
  const [tags, setTags] = useState((product.tags || []).join(', '))
  const [price, setPrice] = useState(product.price || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const baseCost = getPrintfulBaseCost(product.product_type)
  const profit   = calcProfit(price, baseCost)
  const marginColor = !profit ? C.muted
    : profit.earnings <= 0 ? C.red
    : profit.margin < 20   ? C.gold
    : C.teal

  const STYLE_TAGS = ['Abstract', 'Portrait', 'Fantasy', 'Nature', 'Anime', 'Surreal', 'Dark', 'Minimalist', 'Retro', 'Sci-Fi', 'Street Art', 'Watercolor', 'Geometric', 'Psychedelic', 'Vintage']

  const toggleTag = (tag) => {
    const current = tags.split(',').map(t => t.trim()).filter(Boolean)
    const updated = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
    setTags(updated.join(', '))
  }

  const currentTags = tags.split(',').map(t => t.trim()).filter(Boolean)

  const handleSave = async () => {
    if (!title.trim()) return setError('Product title is required.')
    if (!price || isNaN(parseFloat(price))) return setError('Please enter a valid price.')
    // Profit guard — same rule as CreateProductModal
    if (baseCost != null && profit && profit.earnings <= 0) {
      const floor = (Math.ceil(profit.breakEven * 100) / 100).toFixed(2)
      return setError(`Price is too low. You must charge at least $${floor} to cover Printful cost + fees and make a profit.`)
    }
    setSaving(true); setError('')
    try {
      const updates = {
        title: title.trim(),
        description: description.trim() || null,
        tags: currentTags,
        price: parseFloat(price),
        updated_at: new Date().toISOString(),
      }
      const { error: err } = await supabase.from('products').update(updates).eq('id', product.id).eq('user_id', user.id)
      if (err) throw err

      // Update Printful retail price so their records stay in sync
      if (product.printful_variant_ids?.length) {
        getAuthHeader().then(h => fetch('/api/printful?action=updateVariantPrice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({
            variantIds: product.printful_variant_ids,
            retailPrice: parseFloat(price).toFixed(2),
          }),
        }).catch(() => {}))
      }

      onSave({ ...product, ...updates })
      onClose()
    } catch (e) { setError(e.message || 'Something went wrong.') }
    setSaving(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error: err } = await supabase.from('products').delete().eq('id', product.id).eq('user_id', user.id)
      if (err) throw err
      onDelete(product.id)
      onClose()
    } catch (e) { setError(e.message || 'Failed to delete.') }
    setDeleting(false)
  }

  const inputStyle = { width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.2s' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(8,11,20,0.95)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text, marginBottom: 2 }}>Edit Product</h2>
            <div style={{ fontSize: 11, color: C.muted }}>{product.product_type}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Mockup preview */}
          {product.mockup_url && (
            <div style={{ width: '100%', height: 180, borderRadius: 12, overflow: 'hidden', background: `linear-gradient(135deg, ${C.accent}20, ${C.teal}15)` }}>
              <img src={product.mockup_url} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          {/* Title */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              Product Title
              <span style={{ color: title.length > 80 ? C.red : title.length >= 20 ? C.teal : C.muted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{title.length}/80</span>
            </label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={{ ...inputStyle, borderColor: title.length > 80 ? '#FF4D4D88' : C.border }} placeholder="e.g. Cosmic Eagle All-Over Print T-Shirt" />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>💡 Include the product type and art style for better search visibility.</div>
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Description <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              placeholder="Describe your product — materials, inspiration, what makes it special..." />
          </div>

          {/* ── Pricing ── */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>Retail Price (USD)</label>

            {/* Price input with color-coded border */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }}>$</span>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="1" step="0.01"
                style={{ ...inputStyle, paddingLeft: 28, fontSize: 15, fontWeight: 700, borderColor: profit ? marginColor + '88' : C.border }} />
            </div>

            {/* Quick-pick chips */}
            {baseCost && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {[
                  { label: 'Break-even', val: profit ? Math.ceil(profit.breakEven * 100) / 100 : null, color: C.muted },
                  { label: '40% margin', val: Math.ceil(baseCost * 2.4 * 100) / 100, color: C.teal },
                  { label: '55% margin', val: Math.ceil(baseCost * 3.0 * 100) / 100, color: C.gold },
                ].filter(c => c.val).map(chip => (
                  <button key={chip.label} onClick={() => setPrice(chip.val.toFixed(2))}
                    style={{ background: `${chip.color}15`, border: `1px solid ${chip.color}44`, borderRadius: 8, padding: '4px 10px', color: chip.color, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {chip.label}: ${chip.val.toFixed(2)}
                  </button>
                ))}
              </div>
            )}

            {/* Live profit breakdown */}
            {baseCost && profit && (
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '9px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
                  💰 Profit Breakdown
                </div>
                {[
                  { label: 'Printful base cost (est.)', val: `-$${baseCost.toFixed(2)}`,              color: C.muted, bold: false },
                  { label: 'Stripe fee (~2.9% + $0.30)',val: `-$${profit.stripeFee.toFixed(2)}`,      color: C.muted, bold: false },
                  { label: 'Dreamscape fee (10%)',       val: `-$${profit.dreamscapeFee.toFixed(2)}`, color: C.muted, bold: false },
                  { label: 'Your earnings',              val: `$${profit.earnings.toFixed(2)}`,       color: marginColor, bold: true },
                  { label: 'Profit margin',              val: `${Math.round(profit.margin)}%`,        color: marginColor, bold: true },
                ].map(row => (
                  <div key={row.label} style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 12, color: C.muted }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: row.bold ? 700 : 400, color: row.color }}>{row.val}</span>
                  </div>
                ))}
                {/* Margin bar */}
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: marginColor, fontWeight: 700 }}>
                      {profit.earnings <= 0 ? '🚨 Below break-even' : profit.margin < 20 ? '⚠️ Low margin' : profit.margin < 35 ? '✅ Okay' : '✅ Healthy margin'}
                    </span>
                    <span style={{ fontSize: 11, color: C.muted }}>break-even: ${(Math.ceil(profit.breakEven * 100) / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, profit.margin))}%`, background: marginColor, borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </div>
              </div>
            )}

            {/* No pricing data warning */}
            {!baseCost && (
              <div style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}33`, borderRadius: 8, padding: '9px 12px', fontSize: 12, color: C.gold, marginTop: 4 }}>
                ⚠️ No estimated cost data for this product type. Check printful.com to verify your pricing covers the base cost.
              </div>
            )}
          </div>

          {/* Style tags */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>Style Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {STYLE_TAGS.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  style={{ background: currentTags.includes(tag) ? `${C.accent}25` : 'none', border: `1px solid ${currentTags.includes(tag) ? C.accent + '66' : C.border}`, borderRadius: 20, padding: '4px 12px', color: currentTags.includes(tag) ? C.accent : C.muted, fontSize: 11, fontWeight: currentTags.includes(tag) ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {currentTags.includes(tag) ? '✓ ' : ''}{tag}
                </button>
              ))}
            </div>
            <input value={tags} onChange={e => setTags(e.target.value)} style={inputStyle} placeholder="Or type custom tags, comma-separated..." />
            {currentTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                {currentTags.map(tag => (
                  <span key={tag} onClick={() => toggleTag(tag)} style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}33`, borderRadius: 20, padding: '2px 10px', fontSize: 11, color: C.accent, cursor: 'pointer' }}>{tag} ✕</span>
                ))}
              </div>
            )}
          </div>

          {error && <div style={{ background: '#FF4D4D18', border: '1px solid #FF4D4D44', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#FF4D4D' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          {!confirmDelete ? (
            <>
              <button onClick={() => setConfirmDelete(true)}
                style={{ background: '#FF4D4D18', border: '1px solid #FF4D4D44', borderRadius: 10, padding: '10px 16px', color: '#FF4D4D', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                🗑 Delete
              </button>
              <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || (baseCost != null && profit && profit.earnings <= 0)}
                style={{ flex: 2, background: (saving || (baseCost != null && profit && profit.earnings <= 0)) ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: (saving || (baseCost != null && profit && profit.earnings <= 0)) ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : (baseCost != null && profit && profit.earnings <= 0) ? '🔒 Set a Profitable Price' : 'Save Changes ✦'}
              </button>
            </>
          ) : (
            <>
              <div style={{ flex: 1, fontSize: 13, color: C.text, alignSelf: 'center' }}>Delete this product permanently?</div>
              <button onClick={() => setConfirmDelete(false)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Keep It</button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ background: 'linear-gradient(135deg, #FF4D4D, #CC0000)', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shop Card (public view) ───────────────────────────────────
function ShopCard({ product }) {
  const [buying, setBuying] = useState(false)

  const handleBuy = async () => {
    setBuying(true)
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
    } catch { alert('Checkout failed.') }
    setBuying(false)
  }

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden' }} className='ds-card'
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent + '55'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)' }}>
      <div style={{ aspectRatio: '1', background: `linear-gradient(135deg, ${C.accent}18, ${C.teal}18)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {product.mockup_url ? <img src={product.mockup_url} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 40 }}>🎨</span>}
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3, lineHeight: 1.3 }}>{product.title}</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{product.product_type}</div>
        {product.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {product.tags.slice(0, 2).map(tag => <span key={tag} style={{ background: `${C.accent}18`, borderRadius: 10, padding: '1px 7px', fontSize: 10, color: C.accent }}>{tag}</span>)}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.gold, fontFamily: 'Playfair Display, serif' }}>${parseFloat(product.price || 0).toFixed(2)}</span>
          <button onClick={handleBuy} disabled={buying}
            style={{ background: buying ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: buying ? 'not-allowed' : 'pointer' }}>
            {buying ? '...' : 'Buy'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Owner Shop Card (with edit/delete) ────────────────────────
function OwnerShopCard({ product, user, onEdit, onDelete }) {
  const [showEdit, setShowEdit] = useState(false)
  const [currentProduct, setCurrentProduct] = useState(product)

  const handleSave = (updated) => {
    setCurrentProduct(updated)
    onEdit(updated)
  }

  // Live profit calculation
  const baseCost = getPrintfulBaseCost(currentProduct.product_type)
  const profit   = calcProfit(currentProduct.price, baseCost)
  const marginColor = !profit ? C.muted
    : profit.earnings <= 0 ? C.red
    : profit.margin < 20   ? C.gold
    : C.teal

  return (
    <>
      <div style={{ borderRadius: 14, overflow: 'hidden', position: 'relative' }} className='ds-card'
        onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '55'}
        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>

        {/* Edit overlay button on image */}
        <div style={{ position: 'relative' }}>
          <div style={{ aspectRatio: '1', background: `linear-gradient(135deg, ${C.accent}18, ${C.teal}18)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {currentProduct.mockup_url ? <img src={currentProduct.mockup_url} alt={currentProduct.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 40 }}>🎨</span>}
          </div>
          <button onClick={() => setShowEdit(true)}
            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(8,11,20,0.85)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 10px', color: C.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 4 }}>
            ✏️ Edit
          </button>
        </div>

        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3, lineHeight: 1.3 }}>{currentProduct.title}</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{currentProduct.product_type}</div>
          {currentProduct.tags?.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {currentProduct.tags.slice(0, 3).map(tag => <span key={tag} style={{ background: `${C.accent}18`, borderRadius: 10, padding: '1px 7px', fontSize: 10, color: C.accent }}>{tag}</span>)}
            </div>
          )}

          {/* Price + profit strip */}
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: profit ? 8 : 0 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.gold, fontFamily: 'Playfair Display, serif' }}>${parseFloat(currentProduct.price || 0).toFixed(2)}</span>
              {profit && (
                <span style={{ fontSize: 11, fontWeight: 700, color: marginColor, background: `${marginColor}18`, border: `1px solid ${marginColor}33`, borderRadius: 20, padding: '2px 9px' }}>
                  {Math.round(profit.margin)}% margin
                </span>
              )}
            </div>
            {profit && (
              <>
                <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, profit.margin))}%`, background: marginColor, borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: C.muted }}>Your earnings</span>
                  <span style={{ color: marginColor, fontWeight: 700 }}>
                    {profit.earnings > 0 ? `$${profit.earnings.toFixed(2)}` : '🚨 Below break-even'}
                  </span>
                </div>
              </>
            )}
            {!profit && baseCost == null && (
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Open Edit to see profit breakdown</div>
            )}
          </div>

          <button onClick={() => setShowEdit(true)}
            style={{ width: '100%', background: `${C.accent}18`, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: '7px', color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ✏️ Edit Product & Price
          </button>
        </div>
      </div>

      {showEdit && (
        <EditProductModal
          product={currentProduct}
          user={user}
          onClose={() => setShowEdit(false)}
          onSave={handleSave}
          onDelete={(id) => { onDelete(id); setShowEdit(false) }}
        />
      )}
    </>
  )
}

// ── Payouts Card ──────────────────────────────────────────────
function PayoutsCard({ user, profile }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [earnings, setEarnings] = useState({ total: 0, pending: 0, paid: 0, royalties: 0, royaltiesPending: 0 })

  const canSell = profile?.subscription_tier && profile.subscription_tier !== 'free'
  const BUSINESS_TIERS = ['merchant', 'brand', 'enterprise']
  const isBusiness = BUSINESS_TIERS.includes(profile?.subscription_tier)

  useEffect(() => {
    if (user && canSell) { checkStatus(); loadEarnings() }
    else setLoading(false)
  }, [user, profile])

  const checkStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/connect-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) })
      const data = await res.json()
      setStatus(data)
    } catch {}
    setLoading(false)
  }

  const loadEarnings = async () => {
    // Product sales earnings
    const { data: salesData } = await supabase
      .from('orders')
      .select('creator_earnings, payout_status')
      .eq('creator_id', user.id)

    // Artist royalties from others using their artwork
    const { data: royaltyData } = await supabase
      .from('orders')
      .select('artist_royalty, artist_payout_status')
      .eq('original_artist_id', user.id)

    if (salesData) {
      const total   = salesData.reduce((s, o) => s + (o.creator_earnings || 0), 0)
      const paid    = salesData.filter(o => o.payout_status === 'paid').reduce((s, o) => s + (o.creator_earnings || 0), 0)
      const royalties = (royaltyData || []).reduce((s, o) => s + (o.artist_royalty || 0), 0)
      const royaltiesPending = (royaltyData || []).filter(o => o.artist_payout_status === 'pending').reduce((s, o) => s + (o.artist_royalty || 0), 0)
      setEarnings({ total, pending: total - paid, paid, royalties, royaltiesPending })
    }
  }

  const [payingOut, setPayingOut] = useState(false)
  const [payoutResult, setPayoutResult] = useState(null)

  // Handle return from Stripe Connect onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connect') === 'success') {
      checkStatus()
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('connect') === 'refresh') {
      handleConnect()
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const h = await getAuthHeader()
      const res = await fetch('/api/connect-onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h } })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Something went wrong: ' + (data.error || 'Unknown'))
    } catch { alert('Connection error.') }
    setConnecting(false)
  }

  const handlePayout = async () => {
    setPayingOut(true)
    setPayoutResult(null)
    try {
      const h = await getAuthHeader()
      const res = await fetch('/api/payout-trigger', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h } })
      const data = await res.json()
      setPayoutResult(data)
      if (data.success) loadEarnings()
    } catch { setPayoutResult({ error: 'Connection error' }) }
    setPayingOut(false)
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Payouts & Earnings</div>

      {!canSell ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>Upgrade to Starter or above to set up payouts and start earning from your sales.</div>
          <button onClick={() => navigate('/pricing')} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '8px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⬆ Upgrade</button>
        </div>
      ) : loading ? (
        <div style={{ color: C.muted, fontSize: 13 }}>Checking payout status...</div>
      ) : !status?.connected ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 4 }}>Connect your bank account</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>Set up your Stripe account to receive payments directly to your bank.</div>
          </div>
          <button onClick={handleConnect} disabled={connecting}
            style={{ background: `linear-gradient(135deg, ${C.teal}, #00A884)`, border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: connecting ? 'not-allowed' : 'pointer' }}>
            {connecting ? 'Connecting...' : '🏦 Set Up Payouts'}
          </button>
        </div>
      ) : !status?.enabled ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: C.gold, fontWeight: 600, marginBottom: 4 }}>⚠️ Payout setup incomplete</div>
            <div style={{ fontSize: 12, color: C.muted }}>Finish setting up your Stripe account to start receiving payments.</div>
          </div>
          <button onClick={handleConnect} disabled={connecting}
            style={{ background: `${C.gold}22`, border: `1px solid ${C.gold}55`, borderRadius: 10, padding: '10px 20px', color: C.gold, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Complete Setup →
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            <span style={{ background: `${C.teal}20`, border: `1px solid ${C.teal}44`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, color: C.teal }}>✅ Payouts Active</span>
            <button onClick={handlePayout} disabled={payingOut || earnings.pending <= 0}
              style={{ background: earnings.pending > 0 && !payingOut ? `linear-gradient(135deg, ${C.teal}, #00A884)` : C.border, border: 'none', borderRadius: 10, padding: '8px 16px', color: earnings.pending > 0 && !payingOut ? '#fff' : C.muted, fontSize: 12, fontWeight: 700, cursor: earnings.pending > 0 && !payingOut ? 'pointer' : 'not-allowed' }}>
              {payingOut ? '⏳ Processing...' : earnings.pending > 0 ? `💸 Request Payout ($${earnings.pending.toFixed(2)})` : '✓ Nothing Pending'}
            </button>
          </div>
          {payoutResult && (
            <div style={{ background: payoutResult.success ? `${C.teal}12` : `${C.red}12`, border: `1px solid ${payoutResult.success ? C.teal+'44' : C.red+'44'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: payoutResult.success ? C.teal : C.red }}>
              {payoutResult.success
                ? `✅ $${payoutResult.transferred.toFixed(2)} transferred across ${payoutResult.orderCount} orders — arrives in 2-7 business days`
                : `⚠️ ${payoutResult.error || payoutResult.message}`}
            </div>
          )}

          {/* Product sales */}
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>🛍 Product Sales</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {[['Total Earned', earnings.total, C.gold], ['Pending', earnings.pending, C.accent], ['Paid Out', earnings.paid, C.teal]].map(([label, amount, color]) => (
              <div key={label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                <div className='ds-stat-num' style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color }}>${parseFloat(amount || 0).toFixed(2)}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Artist royalties */}
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>✦ Artist Royalties</div>
          {earnings.royalties > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: `${C.gold}10`, border: `1px solid ${C.gold}33`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                <div className='ds-stat-num' style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: C.gold }}>${parseFloat(earnings.royalties || 0).toFixed(2)}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Total Royalties</div>
              </div>
              <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: C.accent }}>${parseFloat(earnings.royaltiesPending || 0).toFixed(2)}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Pending</div>
              </div>
            </div>
          ) : (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', fontSize: 13, color: C.muted }}>
              No royalties yet. <button onClick={() => navigate('/profile?tab=artwork')} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 13, padding: 0 }}>Publish artwork with a royalty license</button> to earn from every sale others make using your art.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── My Profile Page (/profile) ────────────────────────────────
// ── Analytics Tab (Business tiers) ───────────────────────────
function AnalyticsTab({ user, products }) {
  const [stats, setStats]         = useState(null)
  const [topProducts, setTop]     = useState([])
  const [recentOrders, setRecent] = useState([])
  const [loading, setLoading]     = useState(true)
  const [range, setRange]         = useState(30) // days
  const [exporting, setExporting] = useState(false)

  useEffect(() => { loadAnalytics() }, [range])

  const exportCSV = async () => {
    setExporting(true)
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, created_at, product_name, amount_total, creator_earnings, payout_status, shipping_name')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })

      if (!orders?.length) { alert('No orders to export.'); setExporting(false); return }

      const rows = [
        ['Order ID', 'Date', 'Product', 'Sale Amount', 'Your Earnings', 'Payout Status', 'Customer Name'],
        ...orders.map(o => [
          o.id,
          new Date(o.created_at).toLocaleDateString('en-US'),
          o.product_name || '',
          `$${(o.amount_total || 0).toFixed(2)}`,
          `$${(o.creator_earnings || 0).toFixed(2)}`,
          o.payout_status || 'pending',
          o.shipping_name || '',
        ])
      ]

      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `dreamscape-orders-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Export failed: ' + e.message) }
    setExporting(false)
  }

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const since = new Date()
      since.setDate(since.getDate() - range)
      const sinceIso = since.toISOString()

      const [
        { data: orders },
        { data: royalties },
        { count: totalOrders },
        { count: artworkViews },
      ] = await Promise.all([
        supabase.from('orders').select('creator_earnings, payout_status, created_at, product_id').eq('creator_id', user.id).gte('created_at', sinceIso),
        supabase.from('orders').select('artist_royalty, created_at').eq('original_artist_id', user.id).gte('created_at', sinceIso),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('creator_id', user.id),
        supabase.from('artwork').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_public', true),
      ])

      const revenue    = (orders || []).reduce((s, o) => s + (o.creator_earnings || 0), 0)
      const royaltyInc = (royalties || []).reduce((s, o) => s + (o.artist_royalty || 0), 0)
      const paid       = (orders || []).filter(o => o.payout_status === 'paid').reduce((s, o) => s + (o.creator_earnings || 0), 0)
      setStats({ revenue, royaltyInc, paid, orderCount: orders?.length || 0, totalOrders: totalOrders || 0, artworkViews: artworkViews || 0 })

      // Top products by order count
      const prodMap = {}
      for (const o of orders || []) {
        if (!o.product_id) continue
        prodMap[o.product_id] = (prodMap[o.product_id] || 0) + 1
      }
      const sorted = Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
      const topWithNames = sorted.map(([id, count]) => ({
        id, count,
        product: products.find(p => p.id === id),
      }))
      setTop(topWithNames)
      setRecent((orders || []).slice(-10).reverse())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const fmtMoney = (n) => `$${(n || 0).toFixed(2)}`
  const fmtDate  = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const StatCard = ({ label, value, sub, color }) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div className='ds-stat-num' style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 900, color: color || C.text, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Range selector + export */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text }}>📊 Analytics</h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[[7,'7d'],[30,'30d'],[90,'90d']].map(([days, label]) => (
            <button key={days} onClick={() => setRange(days)}
              style={{ background: range === days ? `${C.accent}25` : 'none', border: `1px solid ${range === days ? C.accent + '66' : C.border}`, borderRadius: 8, padding: '5px 14px', color: range === days ? C.accent : C.muted, fontSize: 12, fontWeight: range === days ? 700 : 400, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
          <button onClick={exportCSV} disabled={exporting}
            style={{ background: exporting ? C.border : `${C.teal}18`, border: `1px solid ${exporting ? C.border : C.teal+'44'}`, borderRadius: 8, padding: '5px 14px', color: exporting ? C.muted : C.teal, fontSize: 12, fontWeight: 700, cursor: exporting ? 'not-allowed' : 'pointer', marginLeft: 6 }}>
            {exporting ? '⏳ Exporting...' : '⬇ CSV'}
          </button>
        </div>
      </div>

      {loading ? <Spinner label="Loading analytics..." /> : !stats ? null : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatCard label="Revenue" value={fmtMoney(stats.revenue)} sub={`Last ${range} days`} color={C.teal} />
            <StatCard label="Paid Out" value={fmtMoney(stats.paid)} sub="Completed payouts" color={C.accent} />
            <StatCard label="Royalties" value={fmtMoney(stats.royaltyInc)} sub="From your artwork" color={C.gold} />
            <StatCard label="Orders" value={stats.orderCount} sub={`${stats.totalOrders} all time`} color={C.text} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Top products */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>⭐ Top Products</div>
              {topProducts.length === 0
                ? <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>No sales yet in this period</div>
                : topProducts.map(({ id, count, product }) => (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: C.border, overflow: 'hidden', flexShrink: 0 }}>
                      {product?.mockup_url && <img src={product.mockup_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product?.title || 'Unknown product'}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{count} order{count !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.teal }}>${((product?.price || 0) * count).toFixed(2)}</div>
                  </div>
                ))
              }
            </div>

            {/* Recent orders */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>🕐 Recent Orders</div>
              {recentOrders.length === 0
                ? <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>No orders yet in this period</div>
                : recentOrders.map((o, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: i < recentOrders.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{fmtDate(o.created_at)}</div>
                      <div style={{ fontSize: 11, color: o.payout_status === 'paid' ? C.teal : C.gold }}>{o.payout_status === 'paid' ? '✓ Paid' : '⏳ Pending'}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.teal }}>{fmtMoney(o.creator_earnings)}</div>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Summary insight */}
          <div style={{ background: `${C.accent}0C`, border: `1px solid ${C.accent}33`, borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>💡</span>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              {stats.orderCount === 0
                ? 'No sales yet this period. Add products to your shop and share them with your audience to start earning.'
                : `You made ${stats.orderCount} sale${stats.orderCount !== 1 ? 's' : ''} in the last ${range} days, earning ${fmtMoney(stats.revenue)} in revenue. ${stats.royaltyInc > 0 ? `Plus ${fmtMoney(stats.royaltyInc)} in artwork royalties.` : ''}`
              }
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Bulk Create Tab (Business tiers) ─────────────────────────
async function bulkGetAuthHeader() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) return { 'Authorization': `Bearer ${session.access_token}` }
  } catch {}
  return {}
}

// Printful catalog keyword matchers — used to find the right product from live catalog
const BULK_PRODUCT_MATCHERS = {
  tshirt:    { kw: ['bella+canvas 3001','unisex jersey short sleeve','unisex staple t-shirt','heavy cotton tee','classic unisex crewneck t'], fallback: ['tee','t-shirt','unisex t'] },
  hoodie:    { kw: ['unisex heavy blend hooded sweatshirt','pullover hoodie','unisex fleece hoodie'], fallback: ['hoodie','pullover'] },
  mug:       { kw: ['white glossy mug','white ceramic mug'], fallback: ['mug','ceramic cup'] },
  poster:    { kw: ['enhanced matte paper poster','poster (in)'], fallback: ['poster','art print'] },
  canvas:    { kw: ['canvas print','gallery wrapped canvas','stretched canvas'], fallback: ['canvas','gallery wrap'] },
  framed:    { kw: ['framed poster','framed print','wood framed poster'], fallback: ['framed','frame'] },
  tote:      { kw: ['tote bag','heavy tote'], fallback: ['tote','canvas bag'] },
  phonecase: { kw: ['tough case for iphone','snap case for iphone'], fallback: ['phone case','iphone case'] },
  pillow:    { kw: ['throw pillow','accent pillow'], fallback: ['pillow','cushion'] },
  wallart:   { kw: ['metal print','acrylic print','wood print','poster hanger'], fallback: ['wall art','metal print','acrylic'] },
}

function findBestCatalogMatch(catalog, productTypeId) {
  const matchers = BULK_PRODUCT_MATCHERS[productTypeId]
  if (!matchers) return null
  const norm = (s) => (s || '').toLowerCase().trim()
  // Try primary keywords first
  for (const kw of matchers.kw) {
    const match = catalog.find(p => norm(p.model).includes(kw))
    if (match) return match
  }
  // Try fallback keywords
  for (const kw of matchers.fallback) {
    const match = catalog.find(p => norm(p.model).includes(kw) || norm(p.type).includes(kw))
    if (match) return match
  }
  return null
}

function BulkCreateTab({ user, artworks, profile }) {
  const [selectedArtworks, setSelectedArtworks] = useState([])
  const [selectedProducts, setSelectedProducts] = useState([])
  const [marginPct, setMarginPct] = useState(40)
  const [queued, setQueued] = useState([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [catalog, setCatalog] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [errorLog, setErrorLog] = useState([])

  const PRODUCT_TYPES = [
    { id: 'tshirt',    label: 'T-Shirt',        icon: '👕', baseCost: 14.95 },
    { id: 'hoodie',    label: 'Hoodie',          icon: '🧥', baseCost: 27.95 },
    { id: 'poster',    label: 'Poster',          icon: '🖼',  baseCost: 11.95 },
    { id: 'canvas',    label: 'Canvas Print',    icon: '🎨', baseCost: 29.95 },
    { id: 'framed',    label: 'Framed Print',    icon: '🖼',  baseCost: 34.95 },
    { id: 'wallart',   label: 'Wall Art',        icon: '🏛',  baseCost: 24.95 },
    { id: 'mug',       label: 'Mug',             icon: '☕', baseCost: 9.95  },
    { id: 'tote',      label: 'Tote Bag',        icon: '🛍',  baseCost: 12.95 },
    { id: 'pillow',    label: 'Throw Pillow',    icon: '🛋',  baseCost: 17.95 },
    { id: 'phonecase', label: 'Phone Case',      icon: '📱', baseCost: 14.95 },
  ]

  useEffect(() => { loadCatalog() }, [])

  const loadCatalog = async () => {
    setCatalogLoading(true)
    try {
      const h = await bulkGetAuthHeader()
      const res = await fetch('/api/printful?action=catalog&offset=0', { headers: h })
      const data = await res.json()
      setCatalog(data.products || [])
    } catch {}
    setCatalogLoading(false)
  }

  const toggleArtwork = (id) => setSelectedArtworks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleProduct = (id) => setSelectedProducts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const calcPrice = (baseCost) => {
    const price = baseCost / (1 - marginPct / 100)
    return Math.ceil(price * 100 - 1) / 100
  }

  const totalItems = selectedArtworks.length * selectedProducts.length

  const handleQueue = () => {
    if (!totalItems) return
    const items = []
    for (const artId of selectedArtworks) {
      for (const prodId of selectedProducts) {
        items.push({ artworkId: artId, productType: prodId, status: 'queued', error: null })
      }
    }
    setQueued(items)
    setDone(false)
    setErrorLog([])
  }

  const updateItem = (i, patch) => setQueued(prev => prev.map((q, idx) => idx === i ? { ...q, ...patch } : q))

  const handleRun = async () => {
    if (!queued.length || running) return
    setRunning(true)
    setErrorLog([])
    const h = await bulkGetAuthHeader()
    const errors = []

    for (let i = 0; i < queued.length; i++) {
      const item = queued[i]
      if (item.status === 'done') continue
      updateItem(i, { status: 'processing', error: null })

      try {
        const art = artworks.find(a => a.id === item.artworkId)
        if (!art?.image_url) throw new Error('Artwork has no image')

        const pt = PRODUCT_TYPES.find(p => p.id === item.productType)
        if (!pt) throw new Error('Unknown product type')

        // 1. Find the catalog product
        const catalogProduct = findBestCatalogMatch(catalog, item.productType)
        if (!catalogProduct) throw new Error(`No Printful product found for ${pt.label}`)

        // 2. Load variants to get White + Black IDs
        const varRes  = await fetch(`/api/printful?action=catalogProduct&id=${catalogProduct.id}`, { headers: h })
        const varData = await varRes.json()
        const variants = varData.variants || []

        // Build color map
        const colorMap = {}
        for (const v of variants) {
          const name = (v.color || 'Default').toLowerCase()
          if (!colorMap[name]) colorMap[name] = { variantIds: [] }
          colorMap[name].variantIds.push(v.id)
        }

        // Pick White + Black by default, fall back to first two colors
        const white = colorMap['white']
        const black = colorMap['black']
        const defaults = [white, black].filter(Boolean)
        if (!defaults.length) {
          const firstTwo = Object.values(colorMap).slice(0, 2)
          defaults.push(...firstTwo)
        }
        const allVariantIds = defaults.flatMap(c => c.variantIds)
        if (!allVariantIds.length) throw new Error('No variants available')

        // 3. Create the Printful product
        const price = calcPrice(pt.baseCost)
        const title = `${art.title || 'My Design'} — ${pt.label}`
        const createRes  = await fetch('/api/printful?action=create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({ title, description: '', variantIds: allVariantIds, imageUrl: art.image_url }),
        })
        const createData = await createRes.json()
        if (!createRes.ok) throw new Error(createData.error?.message || 'Printful create failed')

        const printfulId = createData.id || createData.sync_product?.id || ''

        // 4. Save to Supabase
        await supabase.from('products').insert({
          user_id:               user.id,
          artwork_id:            art.id,
          title,
          description:           '',
          product_type:          catalogProduct.type,
          price:                 price,
          printful_product_id:   String(printfulId),
          printful_variant_ids:  allVariantIds.map(String),
          mockup_url:            art.image_url, // real mockup generated async below
          tags:                  art.style_tags || [],
        })

        // 5. Kick off mockup generation in background (don't wait)
        const firstColorVariants = defaults[0]?.variantIds.slice(0, 3) || []
        if (firstColorVariants.length) {
          fetch('/api/printful?action=mockupCreate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...h },
            body: JSON.stringify({ catalogProductId: catalogProduct.id, variantIds: firstColorVariants, imageUrl: art.image_url }),
          }).catch(() => {})
        }

        updateItem(i, { status: 'done' })

      } catch (err) {
        const msg = err.message || 'Unknown error'
        updateItem(i, { status: 'error', error: msg })
        errors.push({ index: i, message: msg })
      }

      // Rate limit — 1 item per 2.5s to stay within Printful API limits
      if (i < queued.length - 1) await new Promise(r => setTimeout(r, 2500))
    }

    setErrorLog(errors)
    setRunning(false)
    setDone(true)
  }

  const pubArtworks = artworks.filter(a => a.is_public && a.image_url)
  const doneCount  = queued.filter(q => q.status === 'done').length
  const errorCount = queued.filter(q => q.status === 'error').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text, marginBottom: 4 }}>⚡ Bulk Product Creation</h3>
          <p style={{ fontSize: 13, color: C.muted }}>Select artwork + product types to create multiple listings at once.</p>
        </div>
        {done && (
          <div style={{ background: errorCount > 0 ? `${C.gold}18` : `${C.teal}18`, border: `1px solid ${errorCount > 0 ? C.gold+'44' : C.teal+'44'}`, borderRadius: 10, padding: '8px 16px', fontSize: 13, color: errorCount > 0 ? C.gold : C.teal, fontWeight: 600 }}>
            {errorCount > 0 ? `⚠️ ${doneCount} created, ${errorCount} failed` : `✓ All ${doneCount} products created!`}
          </div>
        )}
      </div>

      {catalogLoading ? (
        <Spinner label="Loading Printful catalog..." />
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Step 1 — Select Artwork */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Step 1 — Select Artwork ({selectedArtworks.length} selected)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto', padding: 4 }}>
            {pubArtworks.length === 0
              ? <div style={{ fontSize: 12, color: C.muted, gridColumn: '1/-1' }}>No public artwork yet. Publish some artwork first.</div>
              : pubArtworks.map(art => {
                const sel = selectedArtworks.includes(art.id)
                return (
                  <div key={art.id} onClick={() => toggleArtwork(art.id)}
                    style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: `2px solid ${sel ? C.accent : C.border}`, cursor: 'pointer', aspectRatio: '1', background: C.card, transition: 'border-color 0.15s' }}>
                    <LazyImage src={art.image_url} alt={art.title} width={120} style={{ width: '100%', height: '100%' }} />
                    {sel && (
                      <div style={{ position: 'absolute', inset: 0, background: `${C.accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ background: C.accent, borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700 }}>✓</span>
                      </div>
                    )}
                  </div>
                )
              })
            }
          </div>
        </div>

        {/* Step 2 — Select Product Types */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Step 2 — Product Types ({selectedProducts.length} selected)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PRODUCT_TYPES.map(pt => {
              const sel   = selectedProducts.includes(pt.id)
              const price = calcPrice(pt.baseCost)
              const match = findBestCatalogMatch(catalog, pt.id)
              return (
                <div key={pt.id} onClick={() => match && toggleProduct(pt.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: sel ? `${C.accent}12` : C.card, border: `1px solid ${sel ? C.accent+'55' : C.border}`, borderRadius: 10, padding: '10px 14px', cursor: match ? 'pointer' : 'not-allowed', opacity: match ? 1 : 0.4, transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 18 }}>{pt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: sel ? C.accent : C.text }}>{pt.label}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {match ? `${match.model} · Base $${pt.baseCost} · Sell $${price.toFixed(2)}` : 'Not available in catalog'}
                    </div>
                  </div>
                  {sel && <span style={{ color: C.accent, fontSize: 14, fontWeight: 700 }}>✓</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      )}

      {/* Step 3 — Margin */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Step 3 — Set Margin ({marginPct}%)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input type="range" min={20} max={80} value={marginPct} onChange={e => setMarginPct(Number(e.target.value))}
            style={{ flex: 1, accentColor: C.accent }} />
          <div style={{ fontSize: 13, color: C.text, minWidth: 80, textAlign: 'right' }}>{marginPct}% margin</div>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
          T-Shirt → ${calcPrice(14.95).toFixed(2)} · Hoodie → ${calcPrice(27.95).toFixed(2)} · Mug → ${calcPrice(9.95).toFixed(2)}
        </div>
      </div>

      {/* Queue preview */}
      {totalItems > 0 && queued.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${C.accent}0C`, border: `1px solid ${C.accent}33`, borderRadius: 14, padding: '16px 20px' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Ready to create {totalItems} product{totalItems !== 1 ? 's' : ''}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{selectedArtworks.length} artwork{selectedArtworks.length !== 1 ? 's' : ''} × {selectedProducts.length} product type{selectedProducts.length !== 1 ? 's' : ''} · ~{Math.ceil(totalItems * 2.5 / 60)} min to complete</div>
          </div>
          <button onClick={handleQueue}
            style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 12, padding: '11px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Preview Queue →
          </button>
        </div>
      )}

      {/* Queue list */}
      {queued.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Queue — {queued.length} items</div>
              {running && <div style={{ fontSize: 11, color: C.gold, marginTop: 3 }}>⏳ Processing {doneCount + errorCount + 1} of {queued.length}… please keep this tab open</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!running && !done && (
                <button onClick={handleRun}
                  style={{ background: `linear-gradient(135deg, ${C.teal}, #00A888)`, border: 'none', borderRadius: 10, padding: '8px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  ⚡ Run All
                </button>
              )}
              {!running && (
                <button onClick={() => { setQueued([]); setDone(false); setErrorLog([]) }}
                  style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 14px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
                  Clear
                </button>
              )}
              {done && errorCount > 0 && (
                <button onClick={async () => {
                  setQueued(prev => prev.map(q => q.status === 'error' ? { ...q, status: 'queued', error: null } : q))
                  setDone(false)
                  await new Promise(r => setTimeout(r, 100))
                  handleRun()
                }} style={{ background: `${C.gold}18`, border: `1px solid ${C.gold}44`, borderRadius: 10, padding: '8px 14px', color: C.gold, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ↻ Retry Failed
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {queued.map((item, i) => {
              const art = artworks.find(a => a.id === item.artworkId)
              const pt  = PRODUCT_TYPES.find(p => p.id === item.productType)
              const statusColor = item.status === 'done' ? C.teal : item.status === 'error' ? C.red : item.status === 'processing' ? C.gold : C.muted
              const statusIcon  = item.status === 'done' ? '✓' : item.status === 'error' ? '✕' : item.status === 'processing' ? '⏳' : '○'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: C.bg, borderRadius: 8, border: item.status === 'error' ? `1px solid ${C.red}33` : '1px solid transparent' }}>
                  <span style={{ color: statusColor, fontSize: 13, width: 16, textAlign: 'center', flexShrink: 0 }}>{statusIcon}</span>
                  <div style={{ width: 28, height: 28, borderRadius: 6, overflow: 'hidden', background: C.border, flexShrink: 0 }}>
                    {art?.image_url && <img src={art.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: item.status === 'done' ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {art?.title || 'Artwork'} → {pt?.icon} {pt?.label}
                    </div>
                    {item.error && <div style={{ fontSize: 10, color: C.red, marginTop: 2 }}>{item.error}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: statusColor, fontWeight: 600, flexShrink: 0, textTransform: 'capitalize' }}>
                    {item.status === 'processing' ? 'Creating...' : item.status}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Team Tab (Business tiers) ─────────────────────────────────
const SEAT_LIMITS = { merchant: 3, brand: 10, enterprise: Infinity }
const ROLE_LABELS = { designer: '🎨 Designer', viewer: '👁 Viewer' }

function TeamTab({ user, profile }) {
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [inviteEmail, setEmail] = useState('')
  const [inviteRole, setRole]   = useState('designer')
  const [inviting, setInviting] = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  const seatLimit = SEAT_LIMITS[profile?.subscription_tier] || 3
  const seatsFilled = members.filter(m => m.status !== 'removed').length

  useEffect(() => { loadTeam() }, [])

  const loadTeam = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('account_id', user.id)
      .order('invited_at', { ascending: false })
    setMembers(data || [])
    setLoading(false)
  }

  const handleInvite = async () => {
    setError(''); setSuccess('')
    if (!inviteEmail.trim()) { setError('Enter an email address.'); return }
    setInviting(true)
    try {
      const h = await getAuthHeader()
      const res = await fetch('/api/team-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to invite. Please try again.')
      } else {
        setSuccess(`Invite sent to ${inviteEmail.trim()}`)
        setEmail('')
        await loadTeam()
      }
    } catch {
      setError('Connection error. Please try again.')
    }
    setInviting(false)
  }

  const handleRemove = async (memberId) => {
    if (!window.confirm('Remove this team member?')) return
    await supabase.from('team_members').update({ status: 'removed' }).eq('id', memberId)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: 'removed' } : m))
  }

  const handleRoleChange = async (memberId, newRole) => {
    await supabase.from('team_members').update({ role: newRole }).eq('id', memberId)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
  }

  const activeMembers = members.filter(m => m.status !== 'removed')
  const inp = { width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text, marginBottom: 4 }}>👥 Team</h3>
          <p style={{ fontSize: 13, color: C.muted }}>
            {seatsFilled} of {seatLimit === Infinity ? 'unlimited' : seatLimit} seats used
          </p>
        </div>
        {/* Seat usage bar */}
        {seatLimit !== Infinity && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 120, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (seatsFilled / seatLimit) * 100)}%`, height: '100%', background: seatsFilled >= seatLimit ? C.red : C.accent, borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 12, color: C.muted }}>{seatsFilled}/{seatLimit}</span>
          </div>
        )}
      </div>

      {/* Invite form */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Invite a Team Member</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={inviteEmail} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInvite()}
            placeholder="teammate@company.com" type="email"
            style={{ ...inp, flex: 2, minWidth: 200 }} />
          <select value={inviteRole} onChange={e => setRole(e.target.value)}
            style={{ ...inp, flex: 1, minWidth: 130, cursor: 'pointer' }}>
            <option value="designer">🎨 Designer</option>
            <option value="viewer">👁 Viewer</option>
          </select>
          <button onClick={handleInvite} disabled={inviting || seatsFilled >= seatLimit}
            style={{ background: inviting ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: inviting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
            {inviting ? 'Inviting...' : '+ Invite'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
          Designers can create and manage products. Viewers can see analytics only.
        </div>
        {error && <div style={{ marginTop: 10, background: `${C.red}12`, border: `1px solid ${C.red}33`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: C.red }}>{error}</div>}
        {success && <div style={{ marginTop: 10, background: `${C.teal}12`, border: `1px solid ${C.teal}33`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: C.teal }}>{success}</div>}
      </div>

      {/* Team member list */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
          Team Members ({activeMembers.length})
        </div>
        {loading ? <Spinner label="Loading team..." /> : activeMembers.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
            No team members yet. Invite someone above to get started.
          </div>
        ) : activeMembers.map((m, idx) => (
          <div key={m.id} style={{ padding: '14px 24px', borderBottom: idx < activeMembers.length - 1 ? `1px solid ${C.border}` : 'none', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {/* Avatar placeholder */}
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}80, #4B2FD080)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
              {m.email[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {m.status === 'pending' ? '⏳ Invite pending' : `✓ Active · joined ${new Date(m.joined_at || m.invited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </div>
            </div>
            {/* Role selector */}
            <select value={m.role} onChange={e => handleRoleChange(m.id, e.target.value)}
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 10px', color: C.text, fontSize: 12, cursor: 'pointer', outline: 'none' }}>
              <option value="designer">🎨 Designer</option>
              <option value="viewer">👁 Viewer</option>
            </select>
            {/* Status badge */}
            <div style={{ background: m.status === 'active' ? `${C.teal}18` : `${C.gold}18`, border: `1px solid ${m.status === 'active' ? C.teal + '44' : C.gold + '44'}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, color: m.status === 'active' ? C.teal : C.gold }}>
              {m.status === 'active' ? 'Active' : 'Pending'}
            </div>
            {/* Remove */}
            <button onClick={() => handleRemove(m.id)}
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 10px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Role explanation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          ['🎨 Designer', 'Can create and manage products, view analytics, use bulk tools. Cannot manage team or billing.'],
          ['👁 Viewer', 'Can view analytics and products only. Read-only access to your storefront data.'],
        ].map(([role, desc]) => (
          <div key={role} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6 }}>{role}</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Profile Page ──────────────────────────────────────────────
// ── Wishlist Tab ──────────────────────────────────────────────
function WishlistTab({ user }) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState(null)

  useEffect(() => { loadWishlist() }, [])

  const loadWishlist = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('wishlist')
      .select('*, products(*, profiles!user_id(username))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  const removeItem = async (wishlistId, productId) => {
    setRemoving(productId)
    await supabase.from('wishlist').delete().eq('id', wishlistId)
    setItems(prev => prev.filter(i => i.id !== wishlistId))
    setRemoving(null)
  }

  if (loading) return <Spinner label="Loading wishlist..." />

  if (items.length === 0) return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>♡</div>
      <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text, marginBottom: 8 }}>Your wishlist is empty</h3>
      <p style={{ color: C.muted, fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>Browse the Marketplace and tap ♡ on any product to save it here.</p>
      <button onClick={() => navigate('/marketplace')}
        style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        Browse Marketplace →
      </button>
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{items.length} saved item{items.length !== 1 ? 's' : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {items.map(item => {
          const product = item.products
          if (!product) return null
          return (
            <div key={item.id} className="ds-card" style={{ overflow: 'hidden' }}>
              {/* Image */}
              <div style={{ height: 180, background: `linear-gradient(135deg, ${C.accent}22, ${C.teal}22)`, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}
                onClick={() => navigate(`/product/${product.id}`)}>
                {product.mockup_url
                  ? <img src={product.mockup_url} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 48 }}>🛍</div>
                }
                {/* Remove heart */}
                <button onClick={e => { e.stopPropagation(); removeItem(item.id, product.id) }}
                  disabled={removing === product.id}
                  style={{ position: 'absolute', top: 8, right: 8, background: '#FF6B9D', border: 'none', borderRadius: 8, width: 30, height: 30, color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {removing === product.id ? '·' : '♥'}
                </button>
              </div>
              {/* Details */}
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.teal }}>${parseFloat(product.price || 0).toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>@{product.profiles?.username}</div>
                </div>
                <button onClick={() => navigate(`/product/${product.id}`)}
                  style={{ width: '100%', marginTop: 10, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '8px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Buy Now →
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
  const [artworkFilter, setArtworkFilter] = useState('all') // 'all' | 'public' | 'private'
  const [selectedArtworks, setSelectedArtworks] = useState(new Set())
  const [selectedProducts, setSelectedProducts] = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [sellTarget, setSellTarget] = useState(null)
  const [reuseTarget, setReuseTarget] = useState(null)
  const [followModal, setFollowModal] = useState(null) // 'followers' | 'following'
  const [licenseModal, setLicenseModal] = useState(null) // art waiting for license pick

  const handleStatClick = (key) => {
    if (key === 'artwork') { setTab('artwork'); window.scrollTo({ top: 300, behavior: 'smooth' }) }
    else if (key === 'shop') { setTab('shop'); window.scrollTo({ top: 300, behavior: 'smooth' }) }
    else if (key === 'followers') setFollowModal('followers')
    else if (key === 'following') setFollowModal('following')
  }

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
      const { data: feedArt } = await supabase.from('artwork').select('*, profiles!user_id(username, avatar_url, watermark_enabled, watermark_text, watermark_style, watermark_opacity)').in('user_id', ids).eq('is_public', true).order('created_at', { ascending: false }).limit(40)
      setFeedArtworks(feedArt || [])
    }
    setLoadingFeed(false)
  }

  const handleSaveProfile = (updates) => {
    setProfile(prev => ({ ...prev, ...updates }))
  }

  const handlePublishToggle = async (art) => {
    if (art.is_public) {
      // Unpublishing — instant, no picker needed
      const { error } = await supabase.from('artwork').update({ is_public: false }).eq('id', art.id)
      if (!error) setArtworks(prev => prev.map(a => a.id === art.id ? { ...a, is_public: false } : a))
    } else {
      // Publishing — show license picker first
      setLicenseModal(art)
    }
  }

  const handleLicenseConfirm = async (license, royaltyPct) => {
    const art = licenseModal
    setLicenseModal(null)
    const updates = { is_public: true, license, royalty_pct: royaltyPct }
    const { error } = await supabase.from('artwork').update(updates).eq('id', art.id)
    if (!error) setArtworks(prev => prev.map(a => a.id === art.id ? { ...a, ...updates } : a))
  }

  const handleRefine = (art) => {
    sessionStorage.setItem('dreamRefinePrompt', art.prompt || '')
    navigate('/create')
  }

  const handleDelete = async (art) => {
    if (!window.confirm(`Delete "${art.title}"? This cannot be undone.`)) return
    const { error } = await supabase.from('artwork').delete().eq('id', art.id)
    if (!error) setArtworks(prev => prev.filter(a => a.id !== art.id))
  }

  const handleEditArtwork = (updated) => {
    setArtworks(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
  }

  const BUSINESS_TIERS = ['merchant', 'brand', 'enterprise']
  const isBizAccount = BUSINESS_TIERS.includes(profile?.subscription_tier)

  // ── Bulk artwork actions ────────────────────────────────────
  const toggleSelectArtwork = (id) => setSelectedArtworks(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s
  })
  const selectAllArtworks = () => {
    const visible = artworks.filter(a => artworkFilter === 'all' ? true : artworkFilter === 'public' ? a.is_public : !a.is_public)
    setSelectedArtworks(new Set(visible.map(a => a.id)))
  }
  const clearArtworkSelection = () => setSelectedArtworks(new Set())

  const bulkPublishArtwork = async (isPublic) => {
    if (!selectedArtworks.size) return
    setBulkLoading(true)
    const ids = [...selectedArtworks]
    const { error } = await supabase.from('artwork').update({ is_public: isPublic }).in('id', ids).eq('user_id', user.id)
    if (!error) setArtworks(prev => prev.map(a => ids.includes(a.id) ? { ...a, is_public: isPublic } : a))
    clearArtworkSelection()
    setBulkLoading(false)
  }

  const bulkDeleteArtwork = async () => {
    if (!selectedArtworks.size) return
    if (!window.confirm(`Delete ${selectedArtworks.size} artworks? This cannot be undone.`)) return
    setBulkLoading(true)
    const ids = [...selectedArtworks]
    const { error } = await supabase.from('artwork').delete().in('id', ids).eq('user_id', user.id)
    if (!error) setArtworks(prev => prev.filter(a => !ids.includes(a.id)))
    clearArtworkSelection()
    setBulkLoading(false)
  }

  // ── Bulk product actions ────────────────────────────────────
  const toggleSelectProduct = (id) => setSelectedProducts(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s
  })
  const selectAllProducts = () => setSelectedProducts(new Set(products.map(p => p.id)))
  const clearProductSelection = () => setSelectedProducts(new Set())

  const bulkDeleteProducts = async () => {
    if (!selectedProducts.size) return
    if (!window.confirm(`Delete ${selectedProducts.size} products? This cannot be undone.`)) return
    setBulkLoading(true)
    const ids = [...selectedProducts]
    const { error } = await supabase.from('products').delete().in('id', ids).eq('user_id', user.id)
    if (!error) setProducts(prev => prev.filter(p => !ids.includes(p.id)))
    clearProductSelection()
    setBulkLoading(false)
  }

  const tabs = [
    ['artwork', `🎨 Artwork (${loadingArt ? '…' : artworks.length})`],
    ['shop', `🛍 Shop (${products.length})`],
    ...(isBizAccount ? [
      ['bulk', '⚡ Bulk Create'],
      ['analytics', '📊 Analytics'],
      ['team', '👥 Team'],
    ] : []),
    ['wishlist', '♥ Wishlist'],
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
        onStatClick={handleStatClick}
      />

      {followModal && (
        <FollowListModal
          type={followModal}
          profileId={user.id}
          viewerUser={user}
          onClose={() => setFollowModal(null)}
        />
      )}

      {licenseModal && (
        <LicensePickerModal
          art={licenseModal}
          onConfirm={handleLicenseConfirm}
          onClose={() => setLicenseModal(null)}
        />
      )}

      <div style={{ height: 28 }} />
      <ProfileTabs tab={tab} setTab={setTab} tabs={tabs} />

      {tab === 'artwork' && (
        <>
          {/* Filter + bulk action bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {[['all', 'All'], ['public', '🌐 Published'], ['private', '🔒 Private']].map(([val, label]) => (
                <button key={val} onClick={() => { setArtworkFilter(val); clearArtworkSelection() }}
                  style={{ background: artworkFilter === val ? `${C.accent}25` : 'none', border: `1px solid ${artworkFilter === val ? C.accent + '66' : C.border}`, borderRadius: 8, padding: '6px 14px', color: artworkFilter === val ? C.accent : C.muted, fontSize: 12, fontWeight: artworkFilter === val ? 700 : 400, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
              {/* Select all / clear */}
              <button onClick={selectedArtworks.size ? clearArtworkSelection : selectAllArtworks}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
                {selectedArtworks.size ? `✕ Clear (${selectedArtworks.size})` : '☐ Select All'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              {artworks.filter(a => a.is_public).length} published · {artworks.filter(a => !a.is_public).length} private
            </div>
          </div>

          {/* Bulk action bar — appears when items selected */}
          {selectedArtworks.size > 0 && (
            <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{selectedArtworks.size} selected</span>
              <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                <button onClick={() => bulkPublishArtwork(true)} disabled={bulkLoading}
                  style={{ background: `${C.teal}18`, border: `1px solid ${C.teal}44`, borderRadius: 8, padding: '6px 14px', color: C.teal, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  🌐 Publish All
                </button>
                <button onClick={() => bulkPublishArtwork(false)} disabled={bulkLoading}
                  style={{ background: `${C.muted}12`, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  🔒 Make Private
                </button>
                <button onClick={bulkDeleteArtwork} disabled={bulkLoading}
                  style={{ background: `${C.red}12`, border: `1px solid ${C.red}33`, borderRadius: 8, padding: '6px 14px', color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  🗑 Delete Selected
                </button>
                {bulkLoading && <span style={{ fontSize: 12, color: C.muted, alignSelf: 'center' }}>Working...</span>}
              </div>
            </div>
          )}

          {featuredArtworks.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>⭐ Featured</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {featuredArtworks.map(art => (
                  <div key={art.id} style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.accent}44` }}>
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

          {/* Artwork grid with selectable overlay */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {artworks.filter(a => artworkFilter === 'all' ? true : artworkFilter === 'public' ? a.is_public : !a.is_public).map(art => (
              <div key={art.id} style={{ position: 'relative' }}>
                {/* Checkbox overlay */}
                <div onClick={() => toggleSelectArtwork(art.id)}
                  style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, width: 22, height: 22, borderRadius: 6,
                    background: selectedArtworks.has(art.id) ? C.accent : 'rgba(8,11,20,0.75)',
                    border: `2px solid ${selectedArtworks.has(art.id) ? C.accent : 'rgba(255,255,255,0.3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                  {selectedArtworks.has(art.id) && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
                {/* Dim selected cards */}
                <div style={{ opacity: selectedArtworks.has(art.id) ? 0.85 : 1, outline: selectedArtworks.has(art.id) ? `2px solid ${C.accent}` : 'none', borderRadius: 16, transition: 'all 0.15s' }}>
                  <ArtworkGrid
                    artworks={[art]}
                    loading={false}
                    isOwner={true}
                    onSell={setSellTarget}
                    onReuse={setReuseTarget}
                    onPublishToggle={handlePublishToggle}
                    onRefine={handleRefine}
                    onDelete={handleDelete}
                    onEdit={handleEditArtwork}
                  />
                </div>
              </div>
            ))}
          </div>
          {loadingArt && <Spinner cards={6} />}
        </>
      )}

      {tab === 'shop' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{products.length} product{products.length !== 1 ? 's' : ''} listed</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Click ✏️ Edit on any product to update details</div>
              </div>
              {products.length > 0 && (
                <button onClick={selectedProducts.size ? clearProductSelection : selectAllProducts}
                  style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
                  {selectedProducts.size ? `✕ Clear (${selectedProducts.size})` : '☐ Select All'}
                </button>
              )}
            </div>
            <button onClick={() => navigate('/create')}
              style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '9px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              + Create Product
            </button>
          </div>

          {/* Bulk action bar for products */}
          {selectedProducts.size > 0 && (
            <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{selectedProducts.size} selected</span>
              <button onClick={bulkDeleteProducts} disabled={bulkLoading}
                style={{ background: `${C.red}12`, border: `1px solid ${C.red}33`, borderRadius: 8, padding: '6px 14px', color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                🗑 Delete Selected
              </button>
              {bulkLoading && <span style={{ fontSize: 12, color: C.muted }}>Working...</span>}
            </div>
          )}

          {products.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🛍</div>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>You haven't listed any products yet.</p>
              <button onClick={() => navigate('/create')} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create a Product ✦</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
              {products.map(p => (
                <div key={p.id} style={{ position: 'relative' }}>
                  {/* Product checkbox */}
                  <div onClick={() => toggleSelectProduct(p.id)}
                    style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, width: 22, height: 22, borderRadius: 6,
                      background: selectedProducts.has(p.id) ? C.accent : 'rgba(8,11,20,0.75)',
                      border: `2px solid ${selectedProducts.has(p.id) ? C.accent : 'rgba(255,255,255,0.3)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {selectedProducts.has(p.id) && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ outline: selectedProducts.has(p.id) ? `2px solid ${C.accent}` : 'none', borderRadius: 14, opacity: selectedProducts.has(p.id) ? 0.85 : 1, transition: 'all 0.15s' }}>
                    <OwnerShopCard
                      key={p.id}
                      product={p}
                      user={user}
                      onEdit={(updated) => setProducts(prev => prev.map(x => x.id === updated.id ? updated : x))}
                      onDelete={(id) => setProducts(prev => prev.filter(x => x.id !== id))}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'wishlist' && <WishlistTab user={user} />}

      {tab === 'about' && (
        <div style={{ maxWidth: 640 }}>
          {/* Subscription card */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Subscription</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                {(() => {
                  const tier = profile?.subscription_tier || 'free'
                  const colors = { free: C.muted, starter: C.teal, pro: C.accent, studio: C.gold, merchant: '#FF6B4A', brand: '#FF4F9A', enterprise: C.gold }
                  const color = colors[tier] || C.muted
                  return (
                    <div>
                      <span style={{ background: color + '20', border: `1px solid ${color}44`, borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700, color, textTransform: 'capitalize' }}>✦ {tier} Plan</span>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
                        {tier === 'free'
                          ? 'Upgrade to start selling and earning.'
                          : tier === 'merchant'
                          ? 'Active — 8% commission · Unlimited products · Brand storefront'
                          : tier === 'brand'
                          ? 'Active — 6% commission · Unlimited products · Custom domain'
                          : tier === 'enterprise'
                          ? 'Active — 4% commission · Unlimited everything · White-label + API'
                          : `Active — ${tier === 'starter' ? '25%' : tier === 'pro' ? '20%' : '15%'} Dreamscape commission`}
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

          {/* Payouts card */}
          <PayoutsCard user={user} profile={profile} />
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

      {tab === 'bulk' && isBizAccount && (
        <BulkCreateTab user={user} artworks={artworks} profile={profile} />
      )}

      {tab === 'analytics' && isBizAccount && (
        <AnalyticsTab user={user} products={products} />
      )}

      {tab === 'team' && isBizAccount && (
        <TeamTab user={user} profile={profile} />
      )}

      {tab === 'feed' && (
        followingCount === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>You're not following anyone yet. Browse artists in the <Link to="/marketplace" style={{ color: C.accent }}>Marketplace</Link>.</p>
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
      {sellTarget && (
        <CreateProductModal
          user={user}
          imageUrl={sellTarget.image_url}
          artworkId={sellTarget.id}
          title={sellTarget.title}
          onClose={() => setSellTarget(null)}
          onSuccess={() => setSellTarget(null)}
        />
      )}
      {reuseTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(8,11,20,0.95)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setReuseTarget(null)}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, maxWidth: 500, width: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text }}>Reuse This Artwork</h3>
              <button onClick={() => setReuseTarget(null)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ background: C.bg, maxHeight: 220, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {reuseTarget.image_url && <img src={reuseTarget.image_url} alt={reuseTarget.title} style={{ width: '100%', maxHeight: 220, objectFit: 'contain' }} />}
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{reuseTarget.title}</h4>
              {reuseTarget.prompt && (
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>✦ Original Prompt</div>
                  <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, margin: 0 }}>{reuseTarget.prompt}</p>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                <button onClick={() => { setSellTarget(reuseTarget); setReuseTarget(null) }}
                  style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 12, padding: '12px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  🛍 Sell This
                </button>
                <button onClick={() => { navigate('/create'); setReuseTarget(null) }}
                  style={{ background: `${C.teal}20`, border: `1px solid ${C.teal}44`, borderRadius: 12, padding: '12px', color: C.teal, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  ✦ Remix in Dream
                </button>
                {/* Download — only for own artwork */}
                {user && reuseTarget.user_id === user.id && (
                  <a href={reuseTarget.image_url} download={`${reuseTarget.title || 'dreamscape'}.png`} target="_blank" rel="noreferrer"
                    style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px', color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>
                    ↓ Download
                  </a>
                )}
                <button onClick={() => { navigator.clipboard.writeText(`https://trydreamscape.com/u/${profile?.username}`) }}
                  style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>
                  🔗 Share
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Brand Storefront (/u/:username for business tiers) ────────
function BrandStorefront({ profile, products, artworks, viewerUser, onFollow, isFollowing, followLoading, followerCount }) {
  const navigate = useNavigate()
  const bc = profile.brand_color || '#FF6B4A'
  const brandName = profile.brand_name || profile.display_name || profile.username
  const [tab, setTab] = useState('products')

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Hero banner */}
      <div style={{ position: 'relative', height: 280, overflow: 'hidden', background: `linear-gradient(135deg, ${bc}30, ${bc}10, #030508)` }}>
        {profile.banner_url && (
          <img src={profile.banner_url} alt="Brand banner" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />
        )}
        {/* Overlay gradient */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, transparent 30%, #030508 100%)` }} />
        {/* Chromatic brand accent line */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${bc}, ${bc}88, transparent)` }} />

        {/* Brand identity */}
        <div style={{ position: 'absolute', bottom: 32, left: 32, right: 32, display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          {/* Logo / Avatar */}
          <div style={{ width: 80, height: 80, borderRadius: 16, background: profile.avatar_url ? 'transparent' : `linear-gradient(135deg, ${bc}, ${bc}88)`, border: `3px solid ${bc}`, overflow: 'hidden', flexShrink: 0, boxShadow: `0 0 24px ${bc}44` }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={brandName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, color: '#fff' }}>{brandName[0]?.toUpperCase()}</div>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Tier badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${bc}22`, border: `1px solid ${bc}55`, borderRadius: 8, padding: '2px 10px', marginBottom: 6 }}>
              <span style={{ fontSize: 10 }}>🏢</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: bc, textTransform: 'capitalize' }}>{profile.subscription_tier}</span>
            </div>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 900, color: '#fff', marginBottom: 4, textShadow: `0 0 30px ${bc}44` }}>
              {brandName}
            </h1>
            {profile.brand_tagline && (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: 0 }}>{profile.brand_tagline}</p>
            )}
          </div>
          {/* Follow button */}
          {viewerUser && viewerUser.id !== profile.id && (
            <button onClick={onFollow} disabled={followLoading}
              style={{ background: isFollowing ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${bc}, ${bc}99)`, border: `2px solid ${isFollowing ? 'rgba(255,255,255,0.2)' : bc}`, borderRadius: 10, padding: '10px 22px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {followLoading ? '...' : isFollowing ? 'Following ✓' : '+ Follow'}
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: `${bc}08`, borderBottom: `1px solid ${bc}22`, padding: '14px 32px' }}>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {[
            [products.length, 'Products'],
            [artworks.filter(a => a.is_public).length, 'Artworks'],
            [followerCount, 'Followers'],
          ].map(([val, label]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: bc, fontFamily: 'Playfair Display, serif' }}>{val}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
            </div>
          ))}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: bc, alignSelf: 'center', textDecoration: 'none', borderBottom: `1px solid ${bc}44` }}>
              🔗 {profile.website.replace('https://', '').replace('http://', '')}
            </a>
          )}
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 4, padding: '16px 32px 0', borderBottom: `1px solid ${C.border}` }}>
        {[['products', '🛍 Products'], ['artwork', '🎨 Artwork'], ['about', '✦ About']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ background: tab === id ? `${bc}20` : 'none', border: 'none', borderBottom: `2px solid ${tab === id ? bc : 'transparent'}`, borderRadius: 0, padding: '10px 20px', color: tab === id ? bc : C.muted, fontSize: 13, fontWeight: tab === id ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
        {tab === 'products' && (
          products.length === 0
            ? <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>No products listed yet.</div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                {products.map(product => (
                  <div key={product.id} className="ds-card" style={{ overflow: 'hidden', cursor: 'pointer' }}
                    onClick={() => navigate(`/marketplace`)}>
                    <div style={{ height: 180, background: `linear-gradient(135deg, ${bc}22, ${bc}11)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {product.mockup_url
                        ? <LazyImage src={product.mockup_url} alt={product.title} width={400} style={{ width: '100%', height: '100%' }} />
                        : <span style={{ fontSize: 48 }}>🛍</span>}
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.title}</div>
                      <div style={{ fontSize: 14, color: bc, fontWeight: 700 }}>${parseFloat(product.price || 0).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
        )}

        {tab === 'artwork' && (
          <ArtworkGrid artworks={artworks.filter(a => a.is_public)} loading={false} isOwner={false} />
        )}

        {tab === 'about' && (
          <div style={{ maxWidth: 600 }}>
            {profile.bio && <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.8, marginBottom: 20 }}>{profile.bio}</p>}
            {profile.artist_statement && (
              <div style={{ background: `${bc}0C`, border: `1px solid ${bc}33`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: bc, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Brand Statement</div>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: 0 }}>{profile.artist_statement}</p>
              </div>
            )}
            {profile.location && <div style={{ fontSize: 13, color: C.muted }}>📍 {profile.location}</div>}
          </div>
        )}
      </div>
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
  const [followModal, setFollowModal] = useState(null) // 'followers' | 'following'

  const handleStatClick = (key) => {
    if (key === 'artwork') { setTab('artwork'); window.scrollTo({ top: 300, behavior: 'smooth' }) }
    else if (key === 'shop') { setTab('shop'); window.scrollTo({ top: 300, behavior: 'smooth' }) }
    else if (key === 'followers') setFollowModal('followers')
    else if (key === 'following') setFollowModal('following')
  }

  useMeta({ title: `@${username}`, description: profile?.bio || `View ${username}'s artwork on Dreamscape` })

  useEffect(() => { loadProfile() }, [username])

  const loadProfile = async () => {
    setLoading(true)
    const { data: prof } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle()
    if (!prof) { setLoading(false); return }
    setProfile(prof)
    const [{ data: art }, { data: prods }, { count: followers }, { count: following }] = await Promise.all([
      supabase.from('artwork').select('*').eq('user_id', prof.id).eq('is_public', true).order('created_at', { ascending: false }),
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
      // Fire follow notification in background
      getAuthHeader().then(h => fetch('/api/notify-follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ targetUserId: profile.id }),
      }).catch(() => {}))
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
  const BUSINESS_TIERS = ['merchant', 'brand', 'enterprise']
  const isBrandStorefront = BUSINESS_TIERS.includes(profile.subscription_tier) && profile.storefront_active && !isOwnProfile

  // Render brand storefront for business accounts with storefront enabled
  if (isBrandStorefront) {
    return (
      <BrandStorefront
        profile={profile}
        products={products}
        artworks={artworks}
        viewerUser={viewerUser}
        onFollow={toggleFollow}
        isFollowing={isFollowing}
        followLoading={followLoading}
        followerCount={followerCount}
      />
    )
  }
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
        onStatClick={handleStatClick}
      />

      {followModal && profile && (
        <FollowListModal
          type={followModal}
          profileId={profile.id}
          viewerUser={viewerUser}
          onClose={() => setFollowModal(null)}
        />
      )}

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

// ── Photo To Product ──────────────────────────────────────────
// Lets users take/upload a photo → removes background → goes straight to Sell
function PhotoToProduct({ user, onSignIn, onClose }) {
  const [phase, setPhase]           = useState('capture') // capture | preview | removing | result | error
  const [imageDataUrl, setImage]    = useState(null)
  const [resultDataUrl, setResult]  = useState(null)
  const [error, setError]           = useState('')
  const [dragOver, setDragOver]     = useState(false)
  const fileRef = useRef(null)
  const videoRef = useRef(null)
  const [cameraStream, setStream]   = useState(null)
  const [usingCamera, setUsingCamera] = useState(false)

  // Cleanup camera on unmount
  useEffect(() => {
    return () => { if (cameraStream) cameraStream.getTracks().forEach(t => t.stop()) }
  }, [cameraStream])

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) { setError('Please select an image file.'); return }
    if (file.size > 20 * 1024 * 1024) { setError('Image must be under 20MB.'); return }
    const reader = new FileReader()
    reader.onload = (e) => { setImage(e.target.result); setPhase('preview') }
    reader.readAsDataURL(file)
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 1280 } }
      })
      setStream(stream)
      setUsingCamera(true)
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream }, 100)
    } catch { setError('Camera access denied. Please upload a photo instead.') }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    cameraStream?.getTracks().forEach(t => t.stop())
    setStream(null); setUsingCamera(false)
    setImage(dataUrl); setPhase('preview')
  }

  const removeBackground = async () => {
    if (!user) return onSignIn()
    setPhase('removing'); setError('')
    try {
      const h = await getAuthHeader()
      const res = await fetch('/api/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ imageDataUrl }),
        signal: AbortSignal.timeout(55000),
      })
      const data = await res.json()
      if (data.success) {
        setResult(data.dataUrl); setPhase('result')
      } else {
        setError(data.error || 'Background removal failed'); setPhase('preview')
      }
    } catch (e) {
      setError('Connection error — please try again.'); setPhase('preview')
    }
  }

  const reset = () => {
    setPhase('capture'); setImage(null); setResult(null); setError('')
    cameraStream?.getTracks().forEach(t => t.stop()); setStream(null); setUsingCamera(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(8,11,20,0.96)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: `0 32px 100px rgba(0,0,0,0.7)` }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text }}>📸 Photo to Product</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Snap or upload → remove background → sell instantly</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          {error && (
            <div style={{ background: `${C.red}18`, border: `1px solid ${C.red}44`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: C.red }}>
              ⚠️ {error}
            </div>
          )}

          {/* Phase: capture */}
          {phase === 'capture' && (
            <div>
              {usingCamera ? (
                <div style={{ position: 'relative' }}>
                  <video ref={videoRef} autoPlay playsInline muted
                    style={{ width: '100%', borderRadius: 14, background: C.bg, display: 'block', maxHeight: 320, objectFit: 'cover' }} />
                  <button onClick={capturePhoto}
                    style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: '3px solid #fff', borderRadius: '50%', width: 60, height: 60, fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    📷
                  </button>
                  <button onClick={() => { cameraStream?.getTracks().forEach(t => t.stop()); setStream(null); setUsingCamera(false) }}
                    style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(8,11,20,0.8)', border: 'none', borderRadius: 8, padding: '6px 12px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  {/* Upload drop zone */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
                    onClick={() => fileRef.current?.click()}
                    style={{ border: `2px dashed ${dragOver ? C.accent : C.border}`, borderRadius: 16, padding: '36px 24px', textAlign: 'center', cursor: 'pointer', background: dragOver ? `${C.accent}08` : C.bg, transition: 'all 0.15s', marginBottom: 16 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🖼</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>Drop a photo here or tap to upload</div>
                    <div style={{ fontSize: 12, color: C.muted }}>JPG, PNG, HEIC · Max 20MB</div>
                    <input ref={fileRef} type="file" accept="image/*,image/heic,image/heif" onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
                  </div>

                  {/* Camera button */}
                  {'mediaDevices' in navigator && (
                    <button onClick={startCamera}
                      style={{ width: '100%', background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px', color: C.text, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      📷 Open Camera
                    </button>
                  )}
                </div>
              )}

              {/* What it does */}
              <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
                {[['📸','Take or upload a photo'],['✨','AI removes the background'],['🛍','Instantly create a product']].map(([icon, text]) => (
                  <div key={text} style={{ flex: 1, background: C.bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.4 }}>{text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phase: preview */}
          {phase === 'preview' && imageDataUrl && (
            <div>
              <img src={imageDataUrl} alt="Your photo" style={{ width: '100%', borderRadius: 14, maxHeight: 320, objectFit: 'contain', background: C.bg, display: 'block', marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={reset}
                  style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px', color: C.muted, fontSize: 14, cursor: 'pointer' }}>
                  ← Retake
                </button>
                <button onClick={removeBackground}
                  style={{ flex: 2, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 12, padding: '12px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  ✨ Remove Background
                </button>
              </div>
              <p style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 10 }}>
                Powered by GPT-Image-1 · Takes ~15-20 seconds
              </p>
            </div>
          )}

          {/* Phase: removing */}
          {phase === 'removing' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Removing background...</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>GPT-Image-1 is cutting out your subject.<br />This takes about 15-20 seconds.</div>
              <img src={imageDataUrl} alt="" style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 10, marginTop: 20, opacity: 0.5, filter: 'blur(2px)' }} />
            </div>
          )}

          {/* Phase: result */}
          {phase === 'result' && resultDataUrl && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Original</div>
                  <img src={imageDataUrl} alt="Original" style={{ width: '100%', borderRadius: 10, maxHeight: 160, objectFit: 'contain', background: C.bg }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: C.teal, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Background Removed ✓</div>
                  <img src={resultDataUrl} alt="Result" style={{ width: '100%', borderRadius: 10, maxHeight: 160, objectFit: 'contain', background: 'repeating-conic-gradient(#1a1a2e 0% 25%, #0d0d1a 0% 50%) 0 0 / 16px 16px' }} />
                </div>
              </div>
              <button onClick={() => { onClose(); /* open CreateProductModal with result */ window.dispatchEvent(new CustomEvent('dreamscape:photoProduct', { detail: { imageUrl: resultDataUrl } })) }}
                style={{ width: '100%', background: `linear-gradient(135deg, ${C.teal}, #00A884)`, border: 'none', borderRadius: 12, padding: '14px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
                🛍 Create Product Now →
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={reset}
                  style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>
                  Try Another Photo
                </button>
                <a href={resultDataUrl} download="dreamscape-cutout.png"
                  style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px', color: C.muted, fontSize: 13, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>
                  ↓ Download PNG
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DiscoverPage({ user, onSignIn }) {
  useMeta({ title: null, description: 'Generate AI art, connect with artists worldwide, and sell merchandise globally on Dreamscape.' })
  // Logged-in users get the home feed; guests get the hero
  if (user) return <HomeFeed user={user} />
  return <HeroLanding onSignIn={onSignIn} />
}

// ── Hero Landing (guests) ─────────────────────────────────────
function HeroLanding({ onSignIn }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ artists: null, artworks: null, products: null })

  useEffect(() => {
    const load = async () => {
      try {
        const [{ count: artists }, { count: artworks }, { count: products }] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('artwork').select('id', { count: 'exact', head: true }).eq('is_public', true),
          supabase.from('products').select('id', { count: 'exact', head: true }),
        ])
        setStats({ artists: artists || 0, artworks: artworks || 0, products: products || 0 })
      } catch {}
    }
    load()
  }, [])

  const fmt = (n) => {
    if (n === null) return '—'
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K+'
    return n > 0 ? `${n}+` : '0'
  }

  return (
    <div style={{ minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}18 0%, transparent 70%)`, top: '5%', left: '15%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: `radial-gradient(circle, ${C.teal}12 0%, transparent 70%)`, bottom: '10%', right: '10%', pointerEvents: 'none' }} />
      <div style={{ background: `linear-gradient(135deg, ${C.gold}22, ${C.accent}18)`, border: `1px solid ${C.gold}44`, borderRadius: 20, padding: '6px 18px', marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>🎉</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.gold }}>BETA — Founding member pricing: 50% off all plans forever</span>
        <button onClick={() => navigate('/pricing')} style={{ background: C.gold, border: 'none', borderRadius: 10, padding: '3px 10px', color: '#000', fontSize: 11, fontWeight: 800, cursor: 'pointer', marginLeft: 4 }}>See Plans →</button>
      </div>
      <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}>AI-Powered Artist Platform</div>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(36px, 7vw, 80px)', fontWeight: 900, lineHeight: 1.05, marginBottom: 20, maxWidth: 800 }}>
        Where Artists<br />
        <span style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.teal}, #FF6B9D, ${C.gold}, ${C.accent})`, backgroundSize: '300% 300%', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', animation: 'gradientShift 6s ease infinite', display: 'inline-block' }}>Create & Thrive</span>
      </h1>
      <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: C.muted, maxWidth: 500, lineHeight: 1.7, marginBottom: 36 }}>
        Generate stunning artwork with AI, connect with artists worldwide, and sell merchandise globally.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={onSignIn} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 12, padding: '13px 28px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Start Creating Free ✦</button>
        <button onClick={() => navigate('/marketplace')} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: '13px 28px', color: C.text, fontSize: 14, cursor: 'pointer' }}>Explore Marketplace</button>
      </div>
      <div style={{ display: 'flex', gap: 40, marginTop: 56, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[['Artists', fmt(stats.artists)], ['Artworks', fmt(stats.artworks)], ['Products', fmt(stats.products)], ['Countries', '150+']].map(([label, num]) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div className='ds-stat-num' style={{ fontSize: 26, fontWeight: 800, color: C.text, fontFamily: 'Playfair Display, serif', minWidth: 60 }}>{num}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Home Feed (logged-in users) ───────────────────────────────
function HomeFeed({ user }) {
  const navigate = useNavigate()
  const [feedTab, setFeedTab]           = useState('following')
  const [followingArt, setFollowingArt] = useState([])
  const [trendingArt, setTrendingArt]   = useState([])
  const [suggested, setSuggested]       = useState([])
  const [newProducts, setNewProducts]   = useState([])
  const [loadingFeed, setLoadingFeed]   = useState(true)
  const [loadingTrend, setLoadingTrend] = useState(true)
  const [followingIds, setFollowingIds] = useState(new Set())
  const [togglingId, setTogglingId]     = useState(null)
  const [lightbox, setLightbox]         = useState(null)
  const [createTarget, setCreateTarget] = useState(null)

  useEffect(() => { loadAll() }, [user.id])

  const loadAll = async () => {
    setLoadingFeed(true)
    setLoadingTrend(true)
    try {
      // Load IDs of people the user follows
      const { data: followRows } = await supabase
        .from('follows').select('following_id').eq('follower_id', user.id)
      const ids = (followRows || []).map(r => r.following_id)
      setFollowingIds(new Set(ids))

      // Following feed + trending in parallel
      const [followRes, trendRes, creatorsRes] = await Promise.all([
        ids.length > 0
          ? supabase.from('artwork')
              .select('*, profiles!user_id(id, username, display_name, avatar_url)')
              .in('user_id', ids)
              .eq('is_public', true)
              .or('broken_image.is.null,broken_image.eq.false')
              .order('created_at', { ascending: false })
              .limit(48)
          : Promise.resolve({ data: [] }),
        supabase.from('artwork')
          .select('*, profiles!user_id(id, username, display_name, avatar_url)')
          .eq('is_public', true)
          .or('broken_image.is.null,broken_image.eq.false')
          .order('created_at', { ascending: false })
          .limit(48),
        supabase.from('artwork')
          .select('user_id, profiles!user_id(id, username, display_name, avatar_url, bio)')
          .eq('is_public', true)
          .neq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200),
      ])

      setFollowingArt(followRes.data || [])
      setTrendingArt(trendRes.data || [])

      // Suggested creators — deduplicate, skip already-followed
      const seen = new Set([user.id, ...ids])
      const unique = []
      for (const row of creatorsRes.data || []) {
        if (!seen.has(row.user_id) && row.profiles) {
          seen.add(row.user_id)
          unique.push(row.profiles)
        }
        if (unique.length >= 6) break
      }
      setSuggested(unique)

      // New products from following
      if (ids.length > 0) {
        const { data: prods } = await supabase
          .from('products')
          .select('*, profiles!user_id(username)')
          .in('user_id', ids)
          .or('is_hidden.is.null,is_hidden.eq.false')
          .order('created_at', { ascending: false })
          .limit(6)
        setNewProducts(prods || [])
      }
    } catch (err) {
      console.error('HomeFeed loadAll error:', err.message)
    } finally {
      setLoadingFeed(false)
      setLoadingTrend(false)
    }
  }

  const toggleFollow = async (targetId) => {
    if (togglingId) return
    setTogglingId(targetId)
    if (followingIds.has(targetId)) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId)
      setFollowingIds(prev => { const n = new Set(prev); n.delete(targetId); return n })
      setSuggested(prev => prev.filter(p => p.id !== targetId))
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId })
      setFollowingIds(prev => new Set([...prev, targetId]))
      setSuggested(prev => prev.filter(p => p.id !== targetId))
      // Fire notification
      getAuthHeader().then(h => fetch('/api/notify-follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ targetUserId: targetId }),
      }).catch(() => {}))
    }
    setTogglingId(null)
  }

  const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'there'
  const activeArt  = feedTab === 'following' ? followingArt : trendingArt
  const isLoading  = feedTab === 'following' ? loadingFeed : loadingTrend

  return (
    <div style={{ padding: '32px 20px', maxWidth: 1100, margin: '0 auto' }}>
      {lightbox && (
        <ImageLightbox
          image={lightbox}
          onClose={() => setLightbox(null)}
          onSell={lightbox.art?.user_id === user.id ? () => { setCreateTarget(lightbox.art); setLightbox(null) } : null}
        />
      )}
      {createTarget && (
        <CreateProductModal user={user} imageUrl={createTarget.image_url} title={createTarget.title || ''} onClose={() => setCreateTarget(null)} onSuccess={() => setCreateTarget(null)} />
      )}

      {/* Greeting */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: C.text, marginBottom: 4 }}>
          Welcome back ✦
        </h1>
        <p style={{ color: C.muted, fontSize: 14 }}>
          {followingIds.size > 0
            ? `You're following ${followingIds.size} creator${followingIds.size !== 1 ? 's' : ''}`
            : 'Follow some creators to build your personal feed'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32, alignItems: 'start' }}>
        {/* Main feed */}
        <div>
          {/* Feed tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
            {[['following', '✦ Following'], ['trending', '🔥 Trending']].map(([id, label]) => (
              <button key={id} onClick={() => setFeedTab(id)}
                style={{ background: 'none', border: 'none', borderBottom: `2px solid ${feedTab === id ? C.accent : 'transparent'}`, padding: '8px 18px', color: feedTab === id ? C.accent : C.muted, fontSize: 13, fontWeight: feedTab === id ? 700 : 400, cursor: 'pointer', marginBottom: -1 }}>
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <Spinner label="Loading feed..." />
          ) : activeArt.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
              {feedTab === 'following' ? (
                <>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
                  <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text, marginBottom: 8 }}>Your following feed is empty</h3>
                  <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>Follow some creators to see their latest artwork here. Check out the suggested artists →</p>
                  <button onClick={() => setFeedTab('trending')}
                    style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Browse Trending →
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
                  <p style={{ color: C.muted, fontSize: 14, marginBottom: 20 }}>No artwork yet — be the first to create!</p>
                  <button onClick={() => navigate('/create')}
                    style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Start Creating ✦
                  </button>
                </>
              )}
            </div>
          ) : (
            <div style={{ columns: 'auto 220px', columnGap: 12 }}>
              {activeArt.map(art => (
                <div key={art.id} style={{ breakInside: 'avoid', marginBottom: 12 }}>
                  {/* Creator header above each artwork */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div onClick={() => navigate(`/u/${art.profiles?.username}`)}
                      style={{ width: 24, height: 24, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
                      {art.profiles?.avatar_url
                        ? <img src={art.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>{(art.profiles?.username || '?')[0].toUpperCase()}</div>
                      }
                    </div>
                    <button onClick={() => navigate(`/u/${art.profiles?.username}`)}
                      style={{ background: 'none', border: 'none', color: C.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                      @{art.profiles?.username}
                    </button>
                    <span style={{ fontSize: 10, color: C.muted, marginLeft: 'auto' }}>
                      {new Date(art.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  {/* Artwork card */}
                  <div style={{ borderRadius: 12, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                    onClick={() => setLightbox({ src: art.image_url, alt: art.title || 'AI artwork', title: art.title, username: art.profiles?.username, art })}>
                    <LazyImage src={art.image_url} alt={art.title || 'AI artwork'} width={400}
                      style={{ width: '100%', display: 'block' }} />
                    {art.title && (
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(8,11,20,0.85))', padding: '20px 10px 8px', fontSize: 11, fontWeight: 600, color: '#fff' }}>
                        {art.title}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 20 }}>

          {/* Quick actions */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => navigate('/create')}
                style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                ✦ Create New Artwork
              </button>
              <button onClick={() => navigate('/marketplace')}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', color: C.text, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                🛍 Browse Marketplace
              </button>
              <button onClick={() => navigate('/gallery')}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', color: C.text, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                🎨 Explore Gallery
              </button>
            </div>
          </div>

          {/* New products from following */}
          {newProducts.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>🛍 New from people you follow</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {newProducts.map(p => (
                  <div key={p.id} onClick={() => navigate(`/product/${p.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 0' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: C.border, overflow: 'hidden', flexShrink: 0 }}>
                      {p.mockup_url && <img src={p.mockup_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: C.teal, fontWeight: 700 }}>${parseFloat(p.price || 0).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested creators */}
          {suggested.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>✦ Suggested Creators</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {suggested.map(creator => (
                  <div key={creator.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div onClick={() => navigate(`/u/${creator.username}`)}
                      style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
                      {creator.avatar_url
                        ? <img src={creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff' }}>{(creator.username || '?')[0].toUpperCase()}</div>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {creator.display_name || creator.username}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted }}>@{creator.username}</div>
                    </div>
                    <button onClick={() => toggleFollow(creator.id)} disabled={!!togglingId}
                      style={{ background: followingIds.has(creator.id) ? 'none' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: `1px solid ${followingIds.has(creator.id) ? C.border : 'transparent'}`, borderRadius: 8, padding: '5px 12px', color: followingIds.has(creator.id) ? C.muted : '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      {togglingId === creator.id ? '...' : followingIds.has(creator.id) ? '✓' : '+ Follow'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Create Page (/create) ─────────────────────────────────────
// ── Isolated Create Page — remounts cleanly every visit ─────
function IsolatedCreatePage({ user, onSignIn }) {
  // key forces full remount each time — clears all stale DreamChat state
  return <CreatePage key={`create-${user?.id || 'guest'}`} user={user} onSignIn={onSignIn} />
}

function CreatePage({ user, onSignIn }) {
  useMeta({ title: 'Create with Dream AI', description: 'Generate AI art with Dream AI — describe your vision and create stunning artwork.' })
  const [photoProductImage, setPhotoProductImage] = useState(null)

  useEffect(() => {
    const handler = (e) => setPhotoProductImage(e.detail?.imageUrl || null)
    window.addEventListener('dreamscape:openCreateModal', handler)
    return () => window.removeEventListener('dreamscape:openCreateModal', handler)
  }, [])

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 40px) 16px', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 className='ds-heading-glow' style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px, 5vw, 36px)', marginBottom: 10, color: C.text }}>Create with Dream AI</h1>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>Describe your vision and Dream will craft the perfect prompt — then generate an image and sell it globally.</p>
      </div>
      <DreamChat user={user} onSignIn={onSignIn} />
      {photoProductImage && user && (
        <CreateProductModal
          user={user}
          imageUrl={photoProductImage}
          title=""
          onClose={() => setPhotoProductImage(null)}
          onSuccess={() => setPhotoProductImage(null)}
        />
      )}
    </div>
  )
}

// ── Scroll to Top on Route Change ────────────────────────────
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    document.body.style.overflow = ''
    document.documentElement.style.overflow = ''
  }, [pathname])
  return null
}

// ── Floating Feedback Button ─────────────────────────────────
function FloatingFeedback({ user }) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('bug')
  const [description, setDescription] = useState('')
  const [pageUrl, setPageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pulse, setPulse] = useState(false)
  const [errorBanner, setErrorBanner] = useState(null) // { message, code }

  useEffect(() => {
    const onError = (e) => {
      const cat = e.detail?.category || 'bug'
      const msg = e.detail?.message || 'Unknown error'
      setCategory(cat)
      setDescription(msg)
      setPageUrl(e.detail?.page || window.location.pathname)
      setPulse(true)
      setErrorBanner(msg)
      // Auto-dismiss banner after 8s if user doesn't click
      setTimeout(() => setErrorBanner(null), 8000)
    }
    window.addEventListener('dreamscape:error', onError)
    return () => window.removeEventListener('dreamscape:error', onError)
  }, [])

  const openModal = () => {
    setPageUrl(window.location.pathname)
    setOpen(true)
    setSubmitted(false)
    setPulse(false)
    setErrorBanner(null)
  }

  const openFromBanner = () => {
    setOpen(true)
    setSubmitted(false)
    setPulse(false)
    setErrorBanner(null)
  }

  const submit = async () => {
    if (!description.trim()) return
    setSubmitting(true)
    await supabase.from('bug_reports').insert({
      user_id: user?.id || null,
      category,
      description: description.trim(),
      page_url: pageUrl,
      user_agent: navigator.userAgent,
      status: 'open',
    })
    setSubmitting(false)
    setSubmitted(true)
    setTimeout(() => { setOpen(false); setDescription(''); setCategory('bug'); setPulse(false) }, 2200)
  }

  const CATS = [
    { id: 'bug',        label: '🐛 Bug' },
    { id: 'ui',         label: '🎨 UI Issue' },
    { id: 'generation', label: '🎭 Generation' },
    { id: 'payment',    label: '💳 Payment' },
    { id: 'suggestion', label: '💡 Suggestion' },
    { id: 'other',      label: '📋 Other' },
  ]

  return (
    <>
      <style>{`@keyframes feedbackPulse{0%,100%{box-shadow:0 0 0 0 rgba(245,200,66,0.6)}50%{box-shadow:0 0 0 10px rgba(245,200,66,0)}}@keyframes bannerSlide{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

      {/* Error banner — slides up above feedback button on error */}
      {errorBanner && !open && (
        <div style={{ position: 'fixed', bottom: 64, left: 20, zIndex: 9000, maxWidth: 300, background: `${C.red}EE`, backdropFilter: 'blur(12px)', border: `1px solid ${C.red}`, borderRadius: 14, padding: '10px 14px', animation: 'bannerSlide 0.25s ease', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4 }}>⚠️ Something went wrong</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, marginBottom: 8 }}>
            A report has been pre-filled — add any extra detail and submit.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={openFromBanner}
              style={{ flex: 1, background: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', color: C.red, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              Send Report
            </button>
            <button onClick={() => setErrorBanner(null)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 11, cursor: 'pointer' }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <button onClick={openModal} title="Send feedback or report a bug"
        style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 9000, background: 'rgba(14,18,32,0.92)', backdropFilter: 'blur(16px)', border: `1px solid ${pulse ? C.gold : C.gold + '55'}`, borderRadius: 24, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 7, color: C.gold, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', animation: pulse ? 'feedbackPulse 1.5s ease-in-out infinite' : 'none', transition: 'border-color 0.2s' }}>
        🐛 <span>Feedback</span>
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(8,11,20,0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text }}>Beta Feedback</h3>
                  <span style={{ fontSize: 9, fontWeight: 800, color: C.gold, background: `${C.gold}20`, border: `1px solid ${C.gold}55`, borderRadius: 4, padding: '2px 6px', letterSpacing: 1, textTransform: 'uppercase' }}>Beta</span>
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>Help us squash bugs and ship faster ✦</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {submitted ? (
              <div style={{ padding: '52px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 8 }}>Thanks for the report!</div>
                <div style={{ fontSize: 13, color: C.muted }}>We'll look into it and fix it fast.</div>
              </div>
            ) : (
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>What's the issue?</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {CATS.map(c => (
                      <button key={c.id} onClick={() => setCategory(c.id)}
                        style={{ background: category === c.id ? `${C.accent}20` : C.bg, border: `1px solid ${category === c.id ? C.accent + '66' : C.border}`, borderRadius: 10, padding: '8px 10px', color: category === c.id ? C.accent : C.muted, fontSize: 11, fontWeight: category === c.id ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>What happened?</label>
                  <textarea autoFocus value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="What were you doing? What did you expect vs what happened?"
                    rows={4}
                    style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Page <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(auto-filled)</span></label>
                  <input value={pageUrl} onChange={e => setPageUrl(e.target.value)}
                    style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 14px', color: C.muted, fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
                <button onClick={submit} disabled={submitting || !description.trim()}
                  style={{ background: submitting || !description.trim() ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '12px', color: submitting || !description.trim() ? C.muted : '#fff', fontSize: 13, fontWeight: 700, cursor: submitting || !description.trim() ? 'not-allowed' : 'pointer' }}>
                  {submitting ? 'Sending...' : 'Send Report ✦'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ── Navbar ────────────────────────────────────────────────────

// ── Notification Bell ─────────────────────────────────────────

// ── System Status Indicator ───────────────────────────────────
function SystemStatus() {
  const [status, setStatus] = useState(null) // null=unknown, 'ok', 'degraded', 'down'
  const [tooltip, setTooltip] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(8000) })
        const data = await res.json()
        setStatus(data.status === 'ok' ? 'ok' : 'degraded')
      } catch {
        setStatus('degraded')
      }
    }
    check()
    const interval = setInterval(check, 5 * 60 * 1000) // every 5 min
    return () => clearInterval(interval)
  }, [])

  if (status === null || status === 'ok') return null // invisible when healthy

  const colors = { degraded: C.gold, down: C.red }
  const msgs   = {
    degraded: 'Generation may be slow — our team is on it',
    down:     "Generation is temporarily down — we're fixing it now",
  }

  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => setTooltip(true)} onMouseLeave={() => setTooltip(false)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: `${colors[status]}18`, border: `1px solid ${colors[status]}44`, borderRadius: 20, padding: '4px 10px', cursor: 'default' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: colors[status], animation: 'pulse 1.5s ease-in-out infinite' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: colors[status] }}>
          {status === 'degraded' ? 'Slow' : 'Down'}
        </span>
      </div>
      {tooltip && (
        <div style={{ position: 'absolute', top: 36, right: 0, background: C.card, border: `1px solid ${colors[status]}44`, borderRadius: 10, padding: '8px 12px', fontSize: 12, color: C.text, whiteSpace: 'nowrap', zIndex: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
          {msgs[status]}
        </div>
      )}
    </div>
  )
}

function NotificationBell({ user }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const bellRef = useRef(null)

  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (!user) return
    loadNotifications()
    // Real-time subscription
    const sub = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => loadNotifications()
      )
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user?.id])

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const loadNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
  }

  const markRead = async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  if (!user) return null

  return (
    <div style={{ position: 'relative' }} ref={bellRef}>
      <button onClick={() => setOpen(o => !o)}
        style={{ position: 'relative', background: open ? `${C.accent}20` : 'none', border: `1px solid ${open ? C.accent + '55' : C.border}`, borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, transition: 'all 0.15s' }}>
        🔔
        {unread > 0 && (
          <div style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: C.red, border: `2px solid rgba(8,11,20,0.95)` }} />
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 44, right: 0, width: 320, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, zIndex: 200, boxShadow: `0 8px 40px rgba(4,6,15,0.8), 0 0 0 1px ${C.accent}22`, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Notifications {unread > 0 && <span style={{ background: C.red, borderRadius: 8, padding: '1px 6px', fontSize: 10, color: '#fff', marginLeft: 6 }}>{unread}</span>}</div>
            {unread > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', fontSize: 11, color: C.accent, cursor: 'pointer', fontWeight: 600 }}>Mark all read</button>}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 18px', textAlign: 'center', color: C.muted, fontSize: 13 }}>No notifications yet</div>
            ) : notifications.map(n => (
              <div key={n.id} onClick={() => { markRead(n.id); setOpen(false) }}
                style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, background: n.read ? 'none' : `${C.accent}08`, cursor: 'pointer', transition: 'background 0.15s' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                    {n.type === 'broken_artwork' || n.type === 'broken_product' ? '⚠️' : '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: n.read ? C.muted : C.text, marginBottom: 3 }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{n.message}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 4, opacity: 0.7 }}>
                      {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.accent, flexShrink: 0, marginTop: 4 }} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Navbar({ user, profile, signOut, onSignIn }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenu, setMobileMenu] = useState(false)
  const nav = location.pathname
  const isActive = (path) => path === '/' ? nav === '/' : nav.startsWith(path)

  // Close menu on navigation
  useEffect(() => { setMobileMenu(false) }, [location])

  const mainNavItems = [['/', 'Discover'], ['/gallery', 'Gallery'], ['/marketplace', 'Marketplace'], ['/create', 'Create'], ['/blog', 'Blog'], ['/pricing', 'Pricing']]

  return (
    <>
      <style>{`
        @media (max-width: 900px) { .nav-links-full { display: none !important; } .mobile-menu-btn { display: flex !important; } }
        @media (min-width: 901px) { .mobile-menu-btn { display: none !important; } }
        .nav-link:hover { color: #E8EAF0 !important; background: rgba(124,92,252,0.12) !important; }
        .mobile-menu-overlay { position: fixed; inset: 0; top: 72px; z-index: 98; }
      `}</style>

      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(8,11,20,0.95)', backdropFilter: 'blur(24px)', borderBottom: `1px solid ${C.border}`, height: 72, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16 }}>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}
          onMouseDown={e => {
            e.currentTarget.querySelector('.logo-icon').style.background = '#E8EAF0'
            e.currentTarget.querySelector('.logo-icon').style.color = C.accent
          }}
          onMouseUp={e => {
            e.currentTarget.querySelector('.logo-icon').style.background = `linear-gradient(135deg, ${C.accent}, #4B2FD0)`
            e.currentTarget.querySelector('.logo-icon').style.color = '#ffffff'
          }}
          onMouseLeave={e => {
            e.currentTarget.querySelector('.logo-icon').style.background = `linear-gradient(135deg, ${C.accent}, #4B2FD0)`
            e.currentTarget.querySelector('.logo-icon').style.color = '#ffffff'
          }}>
          <div className="logo-icon" style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#ffffff', transition: 'background 0.15s, color 0.15s', flexShrink: 0 }}>✦</div>
          <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: 20 }}>
            <span style={{ color: '#E8EAF0' }}>Dream</span><span style={{ color: C.accent }}>scape</span>
          </span>
          <span style={{ fontSize: 9, fontWeight: 800, color: C.gold, background: `${C.gold}20`, border: `1px solid ${C.gold}55`, borderRadius: 4, padding: '2px 6px', letterSpacing: 1, textTransform: 'uppercase', marginLeft: 2, flexShrink: 0 }}>Beta</span>
        </Link>

        {/* Desktop nav links */}
        <div className="nav-links-full" style={{ display: 'flex', gap: 2, flex: 1, alignItems: 'center' }}>
          {mainNavItems.map(([path, label]) => (
            <Link key={path} to={path} className="nav-link"
              style={{ borderRadius: 8, padding: '7px 14px', color: isActive(path) ? C.accent : C.muted, fontSize: 14, fontWeight: isActive(path) ? 700 : 500, textDecoration: 'none', transition: 'all 0.15s', background: isActive(path) ? `${C.accent}20` : 'none', border: `1px solid ${isActive(path) ? C.accent + '55' : 'transparent'}` }}>
              {label}
            </Link>
          ))}

        </div>

        {/* Desktop right side */}
        <div className="nav-links-full" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {user ? (
            <>
              {profile?.is_admin && (
                <Link to="/admin" style={{ background: `${C.gold}18`, border: `1px solid ${C.gold}44`, borderRadius: 8, padding: '6px 14px', color: C.gold, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>⚡ Admin</Link>
              )}
              <SystemStatus />
              <NotificationBell user={user} />
              <button onClick={() => setShowPhotoToProduct(true)}
                title="Photo to Product — snap, remove background, sell"
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', color: C.muted, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                📸
              </button>
              <Link to="/orders" style={{ background: isActive('/orders') ? `${C.accent}20` : 'none', border: `1px solid ${isActive('/orders') ? C.accent + '55' : C.border}`, borderRadius: 8, padding: '6px 14px', color: isActive('/orders') ? C.accent : C.muted, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>📦 Orders</Link>

              {/* Subscription tier badge */}
              {(() => {
                const tier = profile?.subscription_tier || 'free'
                const tierConfig = {
                  free:     { label: 'Free',     color: C.muted,    bg: C.muted + '20' },
                  starter:  { label: 'Starter',  color: C.teal,     bg: C.teal + '20' },
                  pro:      { label: 'Pro',      color: C.accent,   bg: C.accent + '20' },
                  studio:   { label: 'Studio',   color: C.gold,     bg: C.gold + '20' },
                  merchant:   { label: 'Merchant',   color: '#FF6B4A', bg: 'rgba(255,107,74,0.18)' },
                  brand:      { label: 'Brand',      color: '#FF4F9A', bg: 'rgba(255,79,154,0.18)' },
                  enterprise: { label: 'Enterprise', color: C.gold,    bg: C.gold + '22' },
                }
                const t = tierConfig[tier] || tierConfig.free
                if (tier === 'free') return null
                return (
                  <Link to="/profile" style={{ textDecoration: 'none' }}>
                    <span style={{ background: t.bg, border: `1px solid ${t.color}44`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: t.color, letterSpacing: 0.3 }}>
                      ✦ {t.label}
                    </span>
                  </Link>
                )
              })()}
              <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', background: nav === '/profile' ? `${C.accent}20` : 'none', border: `1px solid ${nav === '/profile' ? C.accent + '55' : C.border}`, borderRadius: 24, padding: '4px 12px 4px 4px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: profile?.avatar_url ? '#0E1220' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                  {profile?.avatar_url ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{profile?.display_name || profile?.username || 'Profile'}</span>
              </Link>
              <button onClick={signOut} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Sign Out</button>
            </>
          ) : (
            <>
              <button onClick={onSignIn} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 16px', color: C.text, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}>Sign In</button>
              <button onClick={onSignIn} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '8px 18px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Join Free ✦</button>
            </>
          )}
        </div>

        {/* Mobile right side — avatar + hamburger */}
        <div className="mobile-menu-btn" style={{ display: 'none', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          {user && (
            <Link to="/profile" style={{ textDecoration: 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: profile?.avatar_url ? '#0E1220' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', border: `2px solid ${C.border}` }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
              </div>
            </Link>
          )}
          <button onClick={() => setMobileMenu(!mobileMenu)}
            style={{ background: mobileMenu ? `${C.accent}20` : 'none', border: `1px solid ${mobileMenu ? C.accent + '55' : C.border}`, borderRadius: 10, padding: '8px 12px', color: mobileMenu ? C.accent : C.text, cursor: 'pointer', fontSize: 20, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {mobileMenu ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenu && (
        <>
          <div className="mobile-menu-overlay" onClick={() => setMobileMenu(false)} />
          <div style={{ position: 'fixed', top: 72, left: 0, right: 0, zIndex: 99, background: C.panel, borderBottom: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            {/* Nav links */}
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {mainNavItems.map(([path, label]) => (
                <Link key={path} to={path} onClick={() => setMobileMenu(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, padding: '13px 16px', color: isActive(path) ? C.accent : C.text, fontSize: 16, fontWeight: isActive(path) ? 700 : 400, textDecoration: 'none', background: isActive(path) ? `${C.accent}18` : 'none', transition: 'all 0.15s' }}>
                  {label}
                  {isActive(path) && <span style={{ marginLeft: 'auto', color: C.accent, fontSize: 12 }}>●</span>}
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: C.border, margin: '0 16px' }} />

            {/* User section */}
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {user ? (
                <>
                  <Link to="/orders" onClick={() => setMobileMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, padding: '13px 16px', color: C.text, fontSize: 16, textDecoration: 'none' }}>📦 Orders</Link>
                  {profile?.is_admin && <Link to="/admin" onClick={() => setMobileMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, padding: '13px 16px', color: C.gold, fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>⚡ Admin</Link>}
                  <button onClick={() => { signOut(); setMobileMenu(false) }} style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, padding: '13px 16px', color: C.muted, fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>Sign Out</button>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
                  <button onClick={() => { onSignIn(); setMobileMenu(false) }} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px', color: C.text, fontSize: 15, cursor: 'pointer', fontWeight: 500 }}>Sign In</button>
                  <button onClick={() => { onSignIn(); setMobileMenu(false) }} style={{ flex: 1, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '12px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Join Free ✦</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── Success Page (/success) ───────────────────────────────────
// ── Product Share Page (/product/:id) ─────────────────────────

// ── Star Rating Widget ────────────────────────────────────────
function StarRating({ value, onChange, size = 20, readonly = false }) {
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

// ── Product Reviews Section ───────────────────────────────────
function ProductReviews({ productId, user, compact = false }) {
  const [reviews, setReviews]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [myReview, setMyReview] = useState(null)  // user's existing review
  const [rating, setRating]     = useState(0)
  const [body, setBody]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing]   = useState(false)
  const [error, setError]       = useState('')
  const [showAll, setShowAll]   = useState(false)

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
        // Update existing
        const { error: e } = await supabase.from('product_reviews')
          .update({ rating, body: body.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', myReview.id)
        if (e) throw e
      } else {
        // Insert new
        const { error: e } = await supabase.from('product_reviews')
          .insert({ product_id: productId, user_id: user.id, rating, body: body.trim() || null })
        if (e) throw e
      }
      setEditing(false)
      await loadReviews()
    } catch (e) { setError(e.message || 'Failed to submit review.') }
    setSubmitting(false)
  }

  const handleDelete = async () => {
    if (!myReview || !window.confirm('Delete your review?')) return
    await supabase.from('product_reviews').delete().eq('id', myReview.id)
    setMyReview(null); setRating(0); setBody('')
    await loadReviews()
  }

  // Summary stats
  const avg   = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  const dist  = [5,4,3,2,1].map(n => ({ n, count: reviews.filter(r => r.rating === n).length }))
  const shown = showAll ? reviews : reviews.slice(0, compact ? 3 : 5)

  if (loading) return <div style={{ padding: '12px 0', color: C.muted, fontSize: 13 }}>Loading reviews...</div>

  return (
    <div style={{ marginTop: compact ? 0 : 8 }}>
      {/* Summary bar */}
      {reviews.length > 0 && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 40, fontWeight: 900, color: '#F5C842', lineHeight: 1 }}>{avg.toFixed(1)}</div>
            <StarRating value={Math.round(avg)} readonly size={14} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</div>
          </div>
          {!compact && (
            <div style={{ flex: 1, minWidth: 140 }}>
              {dist.map(({ n, count }) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: C.muted, width: 8, textAlign: 'right' }}>{n}</span>
                  <span style={{ fontSize: 11, color: '#F5C842' }}>★</span>
                  <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#F5C842', width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%', borderRadius: 3, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: 11, color: C.muted, width: 16 }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Write / edit review */}
      {user && (!myReview || editing) && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            {myReview ? 'Edit your review' : 'Write a review'}
          </div>
          <StarRating value={rating} onChange={setRating} size={26} />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Share your experience with this product... (optional)"
            maxLength={1000}
            rows={3}
            style={{ width: '100%', marginTop: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          {error && <div style={{ fontSize: 12, color: C.red, marginTop: 6 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={handleSubmit} disabled={submitting || !rating}
              style={{ background: rating ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : C.border, border: 'none', borderRadius: 8, padding: '8px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: rating ? 'pointer' : 'not-allowed' }}>
              {submitting ? 'Submitting...' : myReview ? 'Update Review' : 'Submit Review'}
            </button>
            {myReview && (
              <button onClick={() => { setEditing(false); setRating(myReview.rating); setBody(myReview.body || '') }}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* User's existing review (non-editing) */}
      {myReview && !editing && (
        <div style={{ background: `${C.accent}0A`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '12px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>Your review</span>
              <StarRating value={myReview.rating} readonly size={13} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', padding: 0 }}>✏️ Edit</button>
              <button onClick={handleDelete} style={{ background: 'none', border: 'none', color: C.red, fontSize: 12, cursor: 'pointer', padding: 0 }}>🗑 Delete</button>
            </div>
          </div>
          {myReview.body && <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, margin: 0 }}>{myReview.body}</p>}
        </div>
      )}

      {/* Sign-in prompt */}
      {!user && reviews.length === 0 && (
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Sign in to leave the first review.</div>
      )}

      {/* Review list */}
      {shown.map(r => r.user_id !== user?.id && (
        <div key={r.id} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, overflow: 'hidden', flexShrink: 0 }}>
              {r.profiles?.avatar_url
                ? <img src={r.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700 }}>{(r.profiles?.username || '?')[0].toUpperCase()}</div>
              }
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{r.profiles?.display_name || '@' + r.profiles?.username}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StarRating value={r.rating} readonly size={12} />
                <span style={{ fontSize: 10, color: C.muted }}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
          {r.body && <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>{r.body}</p>}
        </div>
      ))}

      {reviews.filter(r => r.user_id !== user?.id).length > (compact ? 3 : 5) && (
        <button onClick={() => setShowAll(v => !v)}
          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
          {showAll ? 'Show less' : `Show all ${reviews.filter(r => r.user_id !== user?.id).length} reviews`}
        </button>
      )}

      {reviews.length === 0 && user && !myReview && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted, fontSize: 13 }}>
          No reviews yet — be the first to share your experience!
        </div>
      )}
    </div>
  )
}

function ProductPage({ user, onSignIn }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [buyingId, setBuyingId] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.from('products')
      .select('*, profiles!user_id(id, username, display_name, avatar_url)')
      .eq('id', id).single()
      .then(({ data }) => { setProduct(data); setLoading(false) })
  }, [id])

  // Inject OG meta tags dynamically for social sharing
  useEffect(() => {
    if (!product) return
    const setMeta = (prop, content) => {
      let el = document.querySelector(`meta[property="${prop}"]`) || document.querySelector(`meta[name="${prop}"]`)
      if (!el) { el = document.createElement('meta'); el.setAttribute(prop.startsWith('og:') ? 'property' : 'name', prop); document.head.appendChild(el) }
      el.setAttribute('content', content)
    }
    const title = `${product.title} — Dreamscape`
    const desc  = `${product.title} by @${product.profiles?.username} · $${parseFloat(product.price || 0).toFixed(2)} · AI art merchandise on Dreamscape`
    setMeta('og:title', title)
    setMeta('og:description', desc)
    setMeta('og:image', product.mockup_url || product.artwork?.image_url || '')
    setMeta('og:url', window.location.href)
    setMeta('og:type', 'product')
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', title)
    setMeta('twitter:description', desc)
    setMeta('twitter:image', product.mockup_url || '')
    document.title = title
  }, [product])

  const handleBuy = async () => {
    if (!user) return onSignIn()
    setBuyingId(product.id)
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product.title,
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

  const shareUrl = `https://trydreamscape.com/product/${id}`

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: product.title, text: `Check out this AI art merch on Dreamscape!`, url: shareUrl })
    } else {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) return <Spinner label="Loading product..." />
  if (!product) return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🔍</div>
      <div style={{ fontSize: 18, color: C.text, fontFamily: 'Playfair Display, serif' }}>Product not found</div>
      <button onClick={() => navigate('/marketplace')} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Browse Marketplace</button>
    </div>
  )

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px' }}>
      {/* Back */}
      <button onClick={() => navigate('/marketplace')}
        style={{ background: 'none', border: 'none', color: C.muted, fontSize: 13, cursor: 'pointer', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Back to Marketplace
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
        {/* Image */}
        <div style={{ position: 'relative' }}>
          <img src={product.mockup_url || product.image_url} alt={product.title}
            style={{ width: '100%', borderRadius: 20, boxShadow: `0 0 80px ${C.accent}33`, display: 'block' }} />
        </div>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Creator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, overflow: 'hidden', flexShrink: 0 }}>
              {product.profiles?.avatar_url
                ? <img src={product.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff' }}>{(product.profiles?.username || '?')[0].toUpperCase()}</div>
              }
            </div>
            <button onClick={() => navigate(`/u/${product.profiles?.username}`)}
              style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              @{product.profiles?.username || 'artist'}
            </button>
          </div>

          {/* Title + price */}
          <div>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: C.text, marginBottom: 8, lineHeight: 1.3 }}>{product.title}</h1>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.teal, fontFamily: 'Playfair Display, serif' }}>
              ${parseFloat(product.price || 0).toFixed(2)}
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>{product.description}</p>
          )}

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {product.tags.map(tag => (
                <span key={tag} style={{ background: `${C.accent}15`, border: `1px solid ${C.accent}33`, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: C.accent }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Buy + share */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleBuy} disabled={!!buyingId}
              style={{ flex: 1, background: buyingId ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 12, padding: '14px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: buyingId ? 'not-allowed' : 'pointer' }}>
              {buyingId ? '⏳ Processing...' : '🛒 Buy Now'}
            </button>
            <button onClick={handleShare}
              style={{ background: `${C.teal}18`, border: `1px solid ${C.teal}44`, borderRadius: 12, padding: '14px 18px', color: C.teal, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {copied ? '✓ Copied!' : '🔗 Share'}
            </button>
          </div>

          {/* Printful trust line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px' }}>
            <span style={{ fontSize: 16 }}>🏭</span>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Printed & shipped by Printful · Ships worldwide · Fulfilled in 2-5 business days</div>
          </div>
        </div>
      </div>

      {/* Reviews section */}
      <div style={{ marginTop: 48, maxWidth: 720 }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 20 }}>
          ★ Reviews
          {product.review_count > 0 && (
            <span style={{ fontSize: 14, fontWeight: 400, color: C.muted, marginLeft: 12 }}>
              {product.avg_rating} · {product.review_count} review{product.review_count !== 1 ? 's' : ''}
            </span>
          )}
        </h2>
        <ProductReviews productId={product.id} user={user} />
      </div>
    </div>
  )
}

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


// ── Floating Dream Widget ─────────────────────────────────────
function DreamWidget({ user, onSignIn }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "✨ Hey! I'm Dream. What's sparking your imagination right now?" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pulse, setPulse] = useState(true)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // ALL hooks must come before any conditional returns
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) {
      setUnread(0)
      setPulse(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Pulse again after 30s if closed and no unread
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setPulse(true), 30000)
      return () => clearTimeout(t)
    }
  }, [open, messages])

  // Don't show on /create — full Dream is already there
  // This return must come AFTER all hooks above
  if (location.pathname === '/create') return null

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/dream-widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-8) }) // last 8 msgs for context
      })
      const data = await res.json()
      const reply = { role: 'assistant', content: data.reply || "Tell me more ✨", nav: data.nav }
      setMessages(prev => [...prev, reply])
      if (!open) { setUnread(u => u + 1); setPulse(true) }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Oops, something went wrong. Try again!" }])
    }
    setLoading(false)
  }

  const handleNav = (path) => {
    navigate(path)
    setOpen(false)
  }

  const NAV_LABELS = {
    '/create': '✦ Open Dream AI',
    '/gallery': '🎨 Visit Gallery',
    '/marketplace': '🛍 Browse Marketplace',
    '/pricing': '⭐ View Plans',
    '/blog': '📖 Read the Blog',
    '/profile': '👤 Your Profile',
  }

  return (
    <>
      <style>{`
        @keyframes dreamPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(124,92,252,0.7), 0 4px 24px rgba(124,92,252,0.5), 0 0 16px rgba(0,212,170,0.2); }
          50%     { box-shadow: 0 0 0 12px rgba(124,92,252,0), 0 4px 40px rgba(124,92,252,0.7), 0 0 32px rgba(0,212,170,0.35); }
        }
        @keyframes widgetIn {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Chat window */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 90, right: 20, zIndex: 9000,
          width: 340, maxHeight: 500,
          background: C.card, border: `1px solid ${C.accent}55`,
          borderRadius: 20, display: 'flex', flexDirection: 'column',
          boxShadow: `0 8px 60px rgba(124,92,252,0.3), 0 2px 20px rgba(0,0,0,0.5)`,
          animation: 'widgetIn 0.3s cubic-bezier(0.16,1,0.3,1)',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{ padding: '14px 16px', background: `linear-gradient(135deg, ${C.accent}22, ${C.panel})`, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>✦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Dream AI</div>
              <div style={{ fontSize: 11, color: C.teal }}>● always on</div>
            </div>
            <button onClick={() => handleNav('/create')}
              title="Open full Dream AI"
              style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 7, padding: '4px 10px', color: C.accent, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              Full ↗
            </button>
            <button onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200, maxHeight: 340 }}>
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user'
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', animation: 'msgIn 0.25s ease' }}>
                  <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 6, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      padding: '9px 13px',
                      borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: isUser ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : C.panel,
                      border: isUser ? 'none' : `1px solid ${C.border}`,
                      fontSize: 13, lineHeight: 1.6, color: C.text,
                    }}>
                      {msg.content}
                    </div>
                    {/* Navigation suggestion */}
                    {msg.nav && msg.nav.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
                        {msg.nav.map(path => (
                          <button key={path} onClick={() => handleNav(path)}
                            style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: '8px 14px', color: C.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                            {NAV_LABELS[path] || path}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '14px 14px 14px 4px', padding: '10px 14px', display: 'flex', gap: 4 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, flexShrink: 0, background: C.panel }}>
            {!user ? (
              <button onClick={() => { onSignIn(); setOpen(false) }}
                style={{ width: '100%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '11px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Sign In to Chat with Dream ✦
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder="Ask Dream anything..."
                  style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={send} disabled={loading || !input.trim()}
                  style={{ background: loading || !input.trim() ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '9px 14px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer' }}>
                  ✦
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating button */}
      <button onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9001,
          width: 56, height: 56, borderRadius: '50%',
          background: open ? C.panel : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`,
          border: open ? `2px solid ${C.accent}55` : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, color: '#fff', cursor: 'pointer',
          animation: pulse && !open ? 'dreamPulse 2s ease-in-out infinite' : 'none',
          transition: 'all 0.2s ease',
          boxShadow: open ? 'none' : '0 4px 24px rgba(124,92,252,0.4)',
        }}>
        {open ? '✕' : '✦'}
        {/* Unread badge */}
        {!open && unread > 0 && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            width: 18, height: 18, borderRadius: '50%',
            background: C.teal, border: `2px solid ${C.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 900, color: C.bg,
          }}>{unread}</div>
        )}
      </button>
    </>
  )
}

// ── Routed Error Boundary ────────────────────────────────────
function RoutedErrorBoundary({ children }) {
  const location = useLocation()
  return (
    <ErrorBoundary routeKey={location.pathname}>
      {children}
    </ErrorBoundary>
  )
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  usePageTracking()
  const { user, profile, setProfile, signOut, loading } = useAuth()

  // ── Global right-click disable ────────────────────────────────
  // Prevents casual "Save Image As" on artwork. Screenshots can't be
  // blocked at the browser level but this removes the obvious path.
  useEffect(() => {
    const block = (e) => e.preventDefault()
    document.addEventListener('contextmenu', block)
    return () => document.removeEventListener('contextmenu', block)
  }, [])
  const [showAuth, setShowAuth] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showPhotoToProduct, setShowPhotoToProduct] = useState(false)

  // Listen for photoProduct event from PhotoToProduct modal
  useEffect(() => {
    const handler = (e) => {
      setShowPhotoToProduct(false)
      // Small delay to let modal close animate
      setTimeout(() => {
        const event2 = new CustomEvent('dreamscape:openCreateModal', { detail: e.detail })
        window.dispatchEvent(event2)
      }, 150)
    }
    window.addEventListener('dreamscape:photoProduct', handler)
    return () => window.removeEventListener('dreamscape:photoProduct', handler)
  }, [])
  const needsProfileSetup = user && !profile?.username

  // Show onboarding for new users who just completed profile setup
  useEffect(() => {
    if (!user || !profile?.username) return
    const key = `ds_onboarded_${user.id}`
    if (!localStorage.getItem(key)) {
      // Check if they have any artwork — if none, show onboarding
      supabase.from('artwork').select('id', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => {
        if ((count || 0) === 0) setShowOnboarding(true)
      })
    }
  }, [user?.id, profile?.username])
  const { isVerified, isBlockedU13, isBlockedU18, pass } = useAgeGate()

  // Show age gate before anything else (except loading)
  if (!loading && !isVerified) {
    return <AgeGate onPass={(dob) => {
      pass(dob)
      // If user already logged in, save DOB to their profile too
      if (user) {
        supabase.from('profiles').update({ date_of_birth: dob }).eq('id', user.id).then(() => {})
      }
    }} />
  }

  if (loading) return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>✦</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
        {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
      </div>
    </div>
  )

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'DM Sans', sans-serif", position: 'relative', overflow: 'visible' }}>
      <style>{`
        @keyframes pulse        { 0%,100%{opacity:.3} 50%{opacity:1} }
        @keyframes shimmer      { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes generateReady{ 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.15)} }

        @keyframes chromaticBorder {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes cardGlow {
          0%,100% { box-shadow: 0 0 20px rgba(124,92,252,0.12), 0 4px 24px rgba(4,6,15,0.5); }
          50%      { box-shadow: 0 0 35px rgba(124,92,252,0.22), 0 4px 32px rgba(4,6,15,0.5); }
        }
        @keyframes dreamPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(124,92,252,0.7), 0 4px 24px rgba(124,92,252,0.5), 0 0 16px rgba(0,212,170,0.2); }
          50%     { box-shadow: 0 0 0 12px rgba(124,92,252,0), 0 4px 40px rgba(124,92,252,0.7), 0 0 32px rgba(0,212,170,0.35); }
        }
        @keyframes generatePulse {
          0%   { box-shadow: 0 0 0 0 rgba(0,212,170,0.7), 0 0 12px rgba(124,92,252,0.4); }
          50%  { box-shadow: 0 0 0 10px rgba(0,212,170,0), 0 0 28px rgba(124,92,252,0.7); }
          100% { box-shadow: 0 0 0 0 rgba(0,212,170,0), 0 0 12px rgba(124,92,252,0.4); }
        }
        @keyframes avatarRing {
          0%   { background-position: 0% 50%; box-shadow: 0 0 12px rgba(124,92,252,0.5), 0 0 24px rgba(0,212,170,0.2); }
          50%  { background-position: 100% 50%; box-shadow: 0 0 20px rgba(0,212,170,0.6), 0 0 36px rgba(255,107,157,0.25); }
          100% { background-position: 0% 50%; box-shadow: 0 0 12px rgba(124,92,252,0.5), 0 0 24px rgba(0,212,170,0.2); }
        }
        @keyframes navGlow {
          0%,100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        @keyframes btnGlow {
          0%,100% { box-shadow: 0 0 12px rgba(124,92,252,0.35), 0 4px 16px rgba(4,6,15,0.4); }
          50%      { box-shadow: 0 0 24px rgba(124,92,252,0.6), 0 4px 24px rgba(4,6,15,0.5); }
        }
        @keyframes tealBtnGlow {
          0%,100% { box-shadow: 0 0 12px rgba(0,212,170,0.35), 0 4px 16px rgba(4,6,15,0.4); }
          50%      { box-shadow: 0 0 24px rgba(0,212,170,0.6), 0 4px 24px rgba(4,6,15,0.5); }
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #030508; font-size: 15px; }
        a { -webkit-tap-highlight-color: transparent; }
        button { -webkit-tap-highlight-color: transparent; color: inherit; }

        /* ── Image protection ── */
        img { -webkit-user-drag: none; user-drag: none; user-select: none; -webkit-user-select: none; }

        /* ── Navbar bottom chromatic edge ── */
        nav::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(124,92,252,0.6) 20%, rgba(0,212,170,0.7) 50%, rgba(255,107,157,0.5) 80%, transparent 100%);
          background-size: 200% 100%;
          animation: chromaticBorder 5s ease-in-out infinite, navGlow 4s ease-in-out infinite;
        }

        /* ── Cards — vivid chromatic glow ── */
        .ds-card {
          position: relative;
          border-radius: 16px;
          background: ${C.card};
          border: 1px solid transparent;
          transition: transform 0.2s, box-shadow 0.3s;
          animation: cardGlow 5s ease-in-out infinite;
        }
        .ds-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 17px;
          background: linear-gradient(135deg, rgba(124,92,252,0.7), rgba(0,212,170,0.45), rgba(255,107,157,0.45), rgba(245,200,66,0.3), rgba(124,92,252,0.7));
          background-size: 300% 300%;
          animation: chromaticBorder 5s ease-in-out infinite;
          z-index: -1;
          opacity: 0.75;
          filter: blur(0.5px);
        }
        .ds-card::after {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(124,92,252,0.35), rgba(0,212,170,0.2), rgba(255,107,157,0.2), rgba(124,92,252,0.35));
          background-size: 300% 300%;
          animation: chromaticBorder 5s ease-in-out infinite reverse;
          z-index: -2;
          opacity: 0.5;
          filter: blur(8px);
        }
        .ds-card:hover {
          transform: translateY(-3px);
          animation: none;
          box-shadow: 0 0 0 1px rgba(124,92,252,0.5), 0 12px 40px rgba(4,6,15,0.6), 0 0 50px rgba(124,92,252,0.3), 0 0 80px rgba(0,212,170,0.1);
        }
        .ds-card:hover::before { opacity: 1; filter: blur(1px); }
        .ds-card:hover::after  { opacity: 0.8; filter: blur(12px); }

        /* ── Modals — floating glow frame ── */
        .ds-modal {
          border: 1px solid rgba(124,92,252,0.4) !important;
          box-shadow: 0 0 0 1px rgba(124,92,252,0.2), 0 24px 80px rgba(4,6,15,0.8), 0 0 60px rgba(124,92,252,0.2), 0 0 100px rgba(0,212,170,0.08) !important;
        }

        /* ── Input focus glow ── */
        input:not([type='range']):not([type='checkbox']):focus,
        textarea:focus,
        select:focus {
          outline: none !important;
          border-color: rgba(124,92,252,0.7) !important;
          box-shadow: 0 0 0 3px rgba(124,92,252,0.15), 0 0 16px rgba(124,92,252,0.25) !important;
        }

        /* ── Primary gradient button glow ── */
        button[style*="linear-gradient(135deg, #7C5CFC"],
        button[style*="linear-gradient(135deg, ${C.accent}"] {
          animation: btnGlow 3s ease-in-out infinite;
        }
        button[style*="linear-gradient(135deg, #7C5CFC"]:hover,
        button[style*="linear-gradient(135deg, ${C.accent}"]:hover {
          animation: none;
          box-shadow: 0 0 30px rgba(124,92,252,0.6), 0 0 60px rgba(124,92,252,0.2), 0 4px 20px rgba(4,6,15,0.5) !important;
          filter: brightness(1.1);
        }
        /* Teal buttons */
        button[style*="linear-gradient(135deg, #00D4AA"],
        button[style*="linear-gradient(135deg, ${C.teal}"] {
          animation: tealBtnGlow 3s ease-in-out infinite;
        }

        /* ── Avatar glow ring ── */
        .ds-avatar-ring {
          padding: 2px;
          background: linear-gradient(135deg, #7C5CFC, #00D4AA, #FF6B9D, #7C5CFC);
          background-size: 300% 300%;
          animation: avatarRing 4s ease-in-out infinite;
          border-radius: 50%;
        }
        .ds-avatar-ring img,
        .ds-avatar-ring > div {
          border-radius: 50%;
          display: block;
        }

        /* ── Playfair heading glow ── */
        .ds-heading-glow {
          text-shadow: 0 0 30px rgba(124,92,252,0.4), 0 0 60px rgba(124,92,252,0.15);
        }

        /* ── Tag / chip glow on hover ── */
        .ds-tag {
          transition: box-shadow 0.2s, border-color 0.2s;
        }
        .ds-tag:hover {
          box-shadow: 0 0 8px rgba(124,92,252,0.5), 0 0 16px rgba(124,92,252,0.2);
          border-color: rgba(124,92,252,0.7) !important;
        }

        /* ── Section divider line ── */
        .ds-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(124,92,252,0.5) 30%, rgba(0,212,170,0.5) 70%, transparent 100%);
          border: none;
          margin: 32px 0;
          animation: navGlow 4s ease-in-out infinite;
        }

        /* ── Stat number glow ── */
        .ds-stat-num {
          text-shadow: 0 0 20px currentColor;
        }

        @media (max-width: 640px) {
          .nav-links { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>

      <StarField />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingTop: 72 }}>
        <Navbar user={user} profile={profile} signOut={signOut} onSignIn={() => setShowAuth(true)} />
        <div style={{ paddingTop: 72 }}>
          <ScrollToTop />
          <RoutedErrorBoundary>
            <Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#7C5CFC', animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
                </div>
              </div>
            }>
            <Routes>
              <Route path="/" element={<DiscoverPage user={user} onSignIn={() => setShowAuth(true)} />} />
              <Route path="/channels" element={<Navigate to="/marketplace" replace />} />
              <Route path="/channels/:channelName" element={<Navigate to="/marketplace" replace />} />
              <Route path="/gallery" element={<Gallery user={user} onSignIn={() => setShowAuth(true)} />} />
              <Route path="/marketplace" element={<Marketplace user={user} onSignIn={() => setShowAuth(true)} />} />
              <Route path="/create" element={<IsolatedCreatePage user={user} onSignIn={() => setShowAuth(true)} />} />
              <Route path="/profile" element={user ? <ProfilePage user={user} profile={profile} /> : <DiscoverPage user={user} onSignIn={() => setShowAuth(true)} />} />
              <Route path="/u/:username" element={<ArtistProfilePage viewerUser={user} />} />
              <Route path="/pricing" element={<Pricing user={user} onSignIn={() => setShowAuth(true)} />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/sitemap" element={<Sitemap />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/admin" element={<Admin user={user} profile={profile} />} />
              <Route path="/orders" element={<OrderHistory user={user} onSignIn={() => setShowAuth(true)} />} />
              <Route path="/success" element={<SuccessPage />} />
              <Route path="/product/:id" element={<ProductPage user={user} onSignIn={() => setShowAuth(true)} />} />
              <Route path="*" element={<DiscoverPage user={user} onSignIn={() => setShowAuth(true)} />} />
            </Routes>
            </Suspense>
          </RoutedErrorBoundary>
        </div>
        <Suspense fallback={null}>
          {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
          {needsProfileSetup && <ProfileSetup user={user} onComplete={(p) => setProfile(prev => ({ ...prev, ...p }))} />}
        </Suspense>
        {/* Footer */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '20px', textAlign: 'center', marginTop: 40 }}>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', fontSize: 12, color: C.muted }}>
            <Link to="/blog" style={{ color: C.muted, textDecoration: 'none' }}>Blog</Link>
            <Link to="/marketplace" style={{ color: C.muted, textDecoration: 'none' }}>Marketplace</Link>
            <Link to="/pricing" style={{ color: C.muted, textDecoration: 'none' }}>Pricing</Link>
            <Link to="/privacy" style={{ color: C.muted, textDecoration: 'none' }}>Privacy Policy</Link>
            <Link to="/terms" style={{ color: C.muted, textDecoration: 'none' }}>Terms of Service</Link>
            <Link to="/contact" style={{ color: C.muted, textDecoration: 'none' }}>Contact</Link>
            <Link to="/sitemap" style={{ color: C.muted, textDecoration: 'none' }}>Sitemap</Link>
            <span>© {new Date().getFullYear()} Dreamscape. All rights reserved.</span>
          </div>
        </div>
      </div>
      {/* Dream Widget — outside content wrapper to prevent routing interference */}
      <DreamWidget user={user} onSignIn={() => setShowAuth(true)} />
      {/* Floating feedback — always visible during BETA, bottom-left, auto-opens on crash */}
      <FloatingFeedback user={user} />
      {showOnboarding && user && (
        <OnboardingModal user={user} onClose={() => { setShowOnboarding(false); localStorage.setItem(`ds_onboarded_${user.id}`, '1') }} />
      )}
      {showPhotoToProduct && (
        <PhotoToProduct user={user} onSignIn={() => setShowAuth(true)} onClose={() => setShowPhotoToProduct(false)} />
      )}
    </div>
  )
}
