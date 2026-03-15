import { useState, useEffect, useRef, Component } from 'react'
import { Routes, Route, Link, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom'
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
import Terms from './components/Terms'
import Contact from './components/Contact'
import BlogPost from './components/BlogPost'


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
          <p style={{ color: '#6B7494', fontSize: 14, marginBottom: 24, maxWidth: 400 }}>
            {this.state.error?.message || 'This page encountered an error.'}
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
}


// ── Tier Limits ───────────────────────────────────────────────
const TIER_LIMITS = {
  free:    { gens: 10,  products: 3  },
  starter: { gens: 50,  products: 15 },
  pro:     { gens: 200, products: 50 },
  studio:  { gens: Infinity, products: Infinity },
}

async function checkGenerationLimit(userId, tier) {
  if (tier === 'studio') return { allowed: true, used: 0, limit: Infinity }
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
  if (tier === 'studio') return { allowed: true, used: 0, limit: Infinity }
  const limit = TIER_LIMITS[tier]?.products || 3
  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  return { allowed: (count || 0) < limit, used: count || 0, limit }
}


// ── Starfield Background ──────────────────────────────────────
// Stars generated once at module load — never regenerate on re-render
const STARS = (() => {
  const stars = []
  let attempts = 0
  while (stars.length < 40 && attempts < 500) {
    attempts++
    const top = Math.random() * 100
    const left = Math.random() * 100
    const inTopStrip = top < 18
    const inBottomStrip = top > 82
    const inLeftStrip = left < 12
    const inRightStrip = left > 88
    const inCorner = (top < 30 && left < 20) || (top < 30 && left > 80) || (top > 70 && left < 20) || (top > 70 && left > 80)
    if (inTopStrip || inBottomStrip || inLeftStrip || inRightStrip || inCorner) {
      stars.push({
        id: stars.length, top, left,
        size: Math.random() * 16 + 6,
        duration: Math.random() * 6 + 4,
        delay: Math.random() * 8,
        opacity: Math.random() * 0.2 + 0.04,
        grow: Math.random() * 1.6 + 1.2,
      })
    }
  }
  return stars
})()

function StarField() {
  const stars = STARS
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: var(--base-opacity); transform: scale(1) rotate(0deg); }
          50% { opacity: calc(var(--base-opacity) * 3); transform: scale(var(--grow)) rotate(20deg); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes drift1 {
          0%   { transform: translate(0px, 0px) scale(1) rotate(0deg); }
          25%  { transform: translate(30px, -20px) scale(1.06) rotate(5deg); }
          50%  { transform: translate(-20px, 35px) scale(0.96) rotate(-4deg); }
          75%  { transform: translate(25px, 15px) scale(1.04) rotate(8deg); }
          100% { transform: translate(0px, 0px) scale(1) rotate(0deg); }
        }
        @keyframes drift2 {
          0%   { transform: translate(0px, 0px) scale(1) rotate(0deg); }
          33%  { transform: translate(-40px, 25px) scale(1.08) rotate(-6deg); }
          66%  { transform: translate(30px, -30px) scale(0.94) rotate(4deg); }
          100% { transform: translate(0px, 0px) scale(1) rotate(0deg); }
        }
        @keyframes drift3 {
          0%   { transform: translate(0px, 0px) scale(1); }
          50%  { transform: translate(20px, -40px) scale(1.1); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes colorShift {
          0%   { filter: hue-rotate(0deg) brightness(1); }
          20%  { filter: hue-rotate(45deg) brightness(1.2); }
          40%  { filter: hue-rotate(120deg) brightness(0.9); }
          60%  { filter: hue-rotate(200deg) brightness(1.1); }
          80%  { filter: hue-rotate(280deg) brightness(1.3); }
          100% { filter: hue-rotate(360deg) brightness(1); }
        }
      `}</style>

      {/* Deep nebula layer — very visible */}
      <div style={{ position: 'absolute', inset: 0, animation: 'colorShift 25s ease-in-out infinite' }}>

        {/* GIANT nebula cloud — top left, dominant purple */}
        <div style={{
          position: 'absolute', top: '-20%', left: '-15%',
          width: '80%', height: '80%',
          background: 'radial-gradient(ellipse 60% 50% at 45% 45%, rgba(124,92,252,0.7) 0%, rgba(75,47,208,0.5) 25%, rgba(124,92,252,0.3) 50%, rgba(0,212,170,0.15) 70%, transparent 85%)',
          filter: 'blur(30px)',
          animation: 'drift1 28s ease-in-out infinite',
        }} />

        {/* GIANT nebula cloud — bottom right, pink/magenta */}
        <div style={{
          position: 'absolute', bottom: '-25%', right: '-20%',
          width: '85%', height: '75%',
          background: 'radial-gradient(ellipse 55% 60% at 55% 55%, rgba(255,107,157,0.6) 0%, rgba(200,50,200,0.4) 25%, rgba(124,92,252,0.25) 55%, rgba(0,180,216,0.1) 75%, transparent 90%)',
          filter: 'blur(35px)',
          animation: 'drift2 35s ease-in-out infinite',
        }} />

        {/* Center cosmic cloud — teal/cyan */}
        <div style={{
          position: 'absolute', top: '20%', left: '25%',
          width: '65%', height: '60%',
          background: 'radial-gradient(ellipse 50% 55% at 50% 50%, rgba(0,212,170,0.35) 0%, rgba(0,180,216,0.25) 30%, rgba(124,92,252,0.2) 60%, transparent 85%)',
          filter: 'blur(40px)',
          animation: 'drift3 22s ease-in-out infinite',
        }} />

        {/* Top right — electric blue */}
        <div style={{
          position: 'absolute', top: '-10%', right: '-5%',
          width: '55%', height: '60%',
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(0,150,255,0.45) 0%, rgba(0,212,170,0.3) 35%, rgba(124,92,252,0.2) 65%, transparent 85%)',
          filter: 'blur(28px)',
          animation: 'drift1 30s ease-in-out infinite reverse',
        }} />

        {/* Bottom left — gold/amber */}
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-5%',
          width: '60%', height: '55%',
          background: 'radial-gradient(ellipse 55% 50% at 45% 60%, rgba(245,200,66,0.35) 0%, rgba(255,140,0,0.25) 30%, rgba(255,107,157,0.2) 60%, transparent 85%)',
          filter: 'blur(32px)',
          animation: 'drift2 26s ease-in-out infinite reverse',
        }} />

        {/* Center-left accent — deep violet */}
        <div style={{
          position: 'absolute', top: '40%', left: '-5%',
          width: '45%', height: '50%',
          background: 'radial-gradient(ellipse 50% 60% at 40% 50%, rgba(150,0,255,0.4) 0%, rgba(124,92,252,0.3) 35%, transparent 75%)',
          filter: 'blur(36px)',
          animation: 'drift3 18s ease-in-out infinite reverse',
        }} />

        {/* Bright core glow — center */}
        <div style={{
          position: 'absolute', top: '35%', left: '40%',
          width: '30%', height: '30%',
          background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.08) 0%, rgba(124,92,252,0.2) 40%, transparent 70%)',
          filter: 'blur(20px)',
          animation: 'drift1 15s ease-in-out infinite',
        }} />
      </div>

      {/* Stars on top */}
      {stars.map(s => (
        <div key={s.id} style={{
          position: 'absolute',
          top: `${s.top}%`,
          left: `${s.left}%`,
          fontSize: `${s.size}px`,
          color: '#fff',
          '--base-opacity': s.opacity,
          '--grow': s.grow,
          opacity: s.opacity,
          animation: `twinkle ${s.duration}s ease-in-out infinite`,
          animationDelay: `${s.delay}s`,
          userSelect: 'none',
          lineHeight: 1,
          textShadow: '0 0 8px rgba(124,92,252,0.8)',
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

function DreamChat({ user, onSignIn }) {
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saveTarget, setSaveTarget] = useState(null)
  const [savedIndexes, setSavedIndexes] = useState(new Set())
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [generatingIndex, setGeneratingIndex] = useState(null)
  const [generatedImages, setGeneratedImages] = useState({})
  const [lightboxImage, setLightboxImage] = useState(null)
  const [createProductImage, setCreateProductImage] = useState(null)
  const bottomRef = useRef(null)
  const [referenceImage, setReferenceImage] = useState(null)
  const fileInputRef = useRef(null)
  const mountedRef = useRef(true)
  const genTimeoutRef = useRef(null)

  // Track mounted state — prevent setState after unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (genTimeoutRef.current) clearTimeout(genTimeoutRef.current)
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
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
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
        const reader = new FileReader()
        reader.onload = ev => setReferenceImage({ dataUrl: ev.target.result, mimeType: 'image/jpeg', name: file.name })
        reader.readAsDataURL(blob)
      }, 'image/jpeg', 0.75)
    }
    img.src = objectUrl
    e.target.value = ''
  }

  const send = async () => {
    if (!input.trim() || loading) return

    // If user says yes/go after a prompt is ready — just generate immediately
    const YES_TRIGGERS = ['yes', 'yeah', 'yep', 'go', 'do it', 'make it', 'generate', 'create it', "let's go", 'yes please', 'go ahead', 'absolutely', 'sure', 'perfect', 'love it']
    if (YES_TRIGGERS.includes(input.trim().toLowerCase()) && lastAiIndex >= 0 && !generatedImages[lastAiIndex]) {
      setMessages(prev => [...prev, { role: 'user', content: input.trim() }])
      setInput('')
      generateImage(messages[lastAiIndex].content, lastAiIndex)
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
      const res = await fetch('/api/dream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history }) })
      const data = await res.json()

      if (!mountedRef.current) return
      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
        setLoading(false)
        return
      }

      if (!mountedRef.current) return
      const replyMsg = { role: 'assistant', content: data.reply || "Tell me more about what you're imagining..." }
      setMessages(prev => [...prev, replyMsg])
      setLoading(false)
      // Schedule generation OUTSIDE setState — safe async trigger
      if (data.generationPrompt && mountedRef.current) {
        genTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setMessages(prev => {
              const newIndex = prev.length - 1
              generateImage(data.generationPrompt, newIndex, currentRef)
              return prev
            })
          }
        }, 300)
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

  const generateImage = async (prompt, index, refImage = null) => {
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
      const res = await fetch('/api/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, referenceImage: lastUserWithImage })
      })
      if (!mountedRef.current) return
      const data = await res.json()
      if (!mountedRef.current) return
      if (data.success) {
        setGeneratedImages(prev => ({ ...prev, [index]: `data:${data.mimeType};base64,${data.imageData}` }))
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${data.error || 'Image generation failed.'} Try rephrasing or click Generate again.` }])
      }
    } catch {
      if (mountedRef.current) {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Connection error during generation. Please try again.' }])
      }
    } finally {
      if (mountedRef.current) setGeneratingIndex(null)
    }
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
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✦</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Dream AI</div>
            <div style={{ fontSize: 11, color: C.teal }}>● online</div>
          </div>
          {messages.length > 1 && (
            <button onClick={resetChat}
              title="Start a new prompt"
              style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: '6px 14px', color: C.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = `${C.accent}30`; e.currentTarget.style.borderColor = C.accent + '88' }}
              onMouseLeave={e => { e.currentTarget.style.background = `${C.accent}18`; e.currentTarget.style.borderColor = C.accent + '44' }}>
              ✦ New Prompt
            </button>
          )}
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
                <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>Prompt ready — happy with it?</span>
                <style>{`@keyframes generatePulse { 0%,100%{box-shadow:0 0 0 0 rgba(0,212,170,0.5)} 50%{box-shadow:0 0 0 8px rgba(0,212,170,0)} }`}</style>
                <button onClick={() => generatingIndex === null && generateImage(messages[lastAiIndex].content, lastAiIndex)} disabled={generatingIndex !== null}
                  style={{ background: generatingIndex !== null ? C.border : `linear-gradient(135deg, ${C.teal}, #00A884)`, border: 'none', borderRadius: 8, padding: '8px 16px', color: generatingIndex !== null ? C.muted : '#fff', fontSize: 12, fontWeight: 700, cursor: generatingIndex !== null ? 'not-allowed' : 'pointer', animation: generatingIndex === null ? 'generatePulse 2s ease-in-out infinite' : 'none' }}>
                  {generatingIndex !== null ? '⏳ Generating...' : '✦ Generate Image'}
                </button>
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
function ArtworkGrid({ artworks, loading, isOwner = false, onSell, onReuse }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(null)
  const [hover, setHover] = useState(null)
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
        <div key={art.id}
          style={{ background: C.card, border: `1px solid ${hover === art.id ? C.accent + '88' : expanded === art.id ? C.accent + '88' : C.border}`, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s', transform: hover === art.id ? 'translateY(-2px)' : 'none' }}
          onMouseEnter={() => setHover(art.id)}
          onMouseLeave={() => setHover(null)}>
          <div style={{ position: 'relative', height: 160, background: `linear-gradient(135deg, ${C.accent}30, ${C.teal}20)`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}
            onClick={() => setExpanded(expanded === art.id ? null : art.id)}>
            {art.image_url ? <img src={art.image_url} alt={art.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎨'}
            {/* Owner quick actions on image hover */}
            {isOwner && hover === art.id && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,11,20,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={e => e.stopPropagation()}>
                <button onClick={() => onSell && onSell(art)}
                  style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  🛍 Sell
                </button>
                <button onClick={() => onReuse && onReuse(art)}
                  style={{ background: `${C.teal}25`, border: `1px solid ${C.teal}55`, borderRadius: 8, padding: '8px 14px', color: C.teal, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ↻ Reuse
                </button>
              </div>
            )}
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
            {isOwner && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button onClick={e => { e.stopPropagation(); onSell && onSell(art) }}
                  style={{ flex: 1, background: `${C.accent}18`, border: `1px solid ${C.accent}33`, borderRadius: 8, padding: '6px', color: C.accent, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  🛍 Sell This
                </button>
                <button onClick={e => { e.stopPropagation(); onReuse && onReuse(art) }}
                  style={{ flex: 1, background: `${C.teal}18`, border: `1px solid ${C.teal}33`, borderRadius: 8, padding: '6px', color: C.teal, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  ↻ Reuse
                </button>
              </div>
            )}
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>{new Date(art.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
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
    try {
      let avatarUrl = profile?.avatar_url || null
      let bannerUrl = profile?.banner_url || null
      console.log('Saving profile, avatarFile:', avatarFile?.name, 'bannerFile:', bannerFile?.name)
      if (avatarFile) avatarUrl = await uploadImage(avatarFile, 'avatars', `${user.id}/avatar`)
      if (bannerFile) bannerUrl = await uploadImage(bannerFile, 'banners', `${user.id}/banner`)
      console.log('Avatar URL to save:', avatarUrl)
      const tags = styleTags.split(',').map(t => t.trim()).filter(Boolean)
      const updates = {
        id: user.id,
        username: profile?.username,
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
      console.log('Upserting profile:', updates)
      const { error: upsertErr } = await supabase.from('profiles').upsert(updates)
      if (upsertErr) { console.error('Upsert error:', upsertErr); throw upsertErr }
      console.log('Profile saved successfully')
      onSave(updates)
      onClose()
    } catch (err) {
      console.error('Save error:', err)
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

          {/* Price */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Retail Price (USD)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }}>$</span>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" step="0.01"
                style={{ ...inputStyle, paddingLeft: 28 }} placeholder="29.99" />
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>You keep the difference after Printful's base cost + Stripe fees (~2.9% + $0.30).</div>
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
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 2, background: saving ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Changes ✦'}
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
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', transition: 'all 0.2s' }}
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

  return (
    <>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', transition: 'all 0.2s', position: 'relative' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '55'}
        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>

        {/* Edit overlay button on image */}
        <div style={{ position: 'relative' }}>
          <div style={{ aspectRatio: '1', background: `linear-gradient(135deg, ${C.accent}18, ${C.teal}18)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {currentProduct.mockup_url ? <img src={currentProduct.mockup_url} alt={currentProduct.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 40 }}>🎨</span>}
          </div>
          {/* Edit button overlay */}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.gold, fontFamily: 'Playfair Display, serif' }}>${parseFloat(currentProduct.price || 0).toFixed(2)}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowEdit(true)}
                style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: '5px 10px', color: C.accent, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Edit
              </button>
            </div>
          </div>
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
  const [earnings, setEarnings] = useState({ total: 0, pending: 0, paid: 0 })

  const canSell = profile?.subscription_tier && profile.subscription_tier !== 'free'

  useEffect(() => {
    if (user && canSell) {
      checkStatus()
      loadEarnings()
    } else {
      setLoading(false)
    }
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
    const { data } = await supabase.from('orders').select('creator_earnings, payout_status').eq('creator_id', user.id)
    if (data) {
      const total = data.reduce((sum, o) => sum + (o.creator_earnings || 0), 0)
      const paid = data.filter(o => o.payout_status === 'paid').reduce((sum, o) => sum + (o.creator_earnings || 0), 0)
      setEarnings({ total, pending: total - paid, paid })
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/connect-onboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, email: user.email }) })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Something went wrong: ' + (data.error || 'Unknown'))
    } catch { alert('Connection error.') }
    setConnecting(false)
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <span style={{ background: `${C.teal}20`, border: `1px solid ${C.teal}44`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, color: C.teal }}>✅ Payouts Active</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[['Total Earned', earnings.total, C.gold], ['Pending', earnings.pending, C.accent], ['Paid Out', earnings.paid, C.teal]].map(([label, amount, color]) => (
              <div key={label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color }}>${parseFloat(amount || 0).toFixed(2)}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
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
  const [sellTarget, setSellTarget] = useState(null)
  const [reuseTarget, setReuseTarget] = useState(null)

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
          <ArtworkGrid artworks={artworks} loading={loadingArt} isOwner={true} onSell={setSellTarget} onReuse={setReuseTarget} />
        </>
      )}

      {tab === 'shop' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{products.length} product{products.length !== 1 ? 's' : ''} listed</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Click ✏️ Edit on any product to update details or remove it</div>
            </div>
            <button onClick={() => navigate('/create')}
              style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '9px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              + Create Product
            </button>
          </div>
          {products.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🛍</div>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>You haven't listed any products yet.</p>
              <button onClick={() => navigate('/create')} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create a Product ✦</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
              {products.map(p => (
                <OwnerShopCard
                  key={p.id}
                  product={p}
                  user={user}
                  onEdit={(updated) => setProducts(prev => prev.map(x => x.id === updated.id ? updated : x))}
                  onDelete={(id) => setProducts(prev => prev.filter(x => x.id !== id))}
                />
              ))}
            </div>
          )}
        </div>
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
                <a href={reuseTarget.image_url} download={`${reuseTarget.title || 'dreamscape'}.png`} target="_blank" rel="noreferrer"
                  style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px', color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>
                  ↓ Download
                </a>
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
        {[['10K+', 'Artists'], ['50K+', 'Artworks'], ['500+', 'Products'], ['150+', 'Countries']].map(([num, label]) => (
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
// ── Isolated Create Page — remounts cleanly every visit ─────
function IsolatedCreatePage({ user, onSignIn }) {
  // key forces full remount each time — clears all stale DreamChat state
  return <CreatePage key={`create-${user?.id || 'guest'}`} user={user} onSignIn={onSignIn} />
}

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

// ── Navbar ────────────────────────────────────────────────────
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
              <Link to="/orders" style={{ background: isActive('/orders') ? `${C.accent}20` : 'none', border: `1px solid ${isActive('/orders') ? C.accent + '55' : C.border}`, borderRadius: 8, padding: '6px 14px', color: isActive('/orders') ? C.accent : C.muted, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>📦 Orders</Link>

              {/* Subscription tier badge */}
              {(() => {
                const tier = profile?.subscription_tier || 'free'
                const tierConfig = {
                  free:    { label: 'Free',    color: C.muted,   bg: C.muted + '20' },
                  starter: { label: 'Starter', color: C.teal,    bg: C.teal + '20' },
                  pro:     { label: 'Pro',     color: C.accent,  bg: C.accent + '20' },
                  studio:  { label: 'Studio',  color: C.gold,    bg: C.gold + '20' },
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
          0%,100% { box-shadow: 0 0 0 0 rgba(124,92,252,0.5), 0 4px 24px rgba(124,92,252,0.4); }
          50% { box-shadow: 0 0 0 10px rgba(124,92,252,0), 0 4px 32px rgba(124,92,252,0.6); }
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
  const [showAuth, setShowAuth] = useState(false)
  const needsProfileSetup = user && !profile?.username

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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@700;900&display=swap');
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080B14; font-size: 15px; }
        a { -webkit-tap-highlight-color: transparent; }
        button { -webkit-tap-highlight-color: transparent; }
        @media (max-width: 640px) {
          .nav-links { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>

      <StarField />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        <Navbar user={user} profile={profile} signOut={signOut} onSignIn={() => setShowAuth(true)} />
        <div style={{ paddingTop: 72 }}>
          <ScrollToTop />
          <RoutedErrorBoundary>
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
              <Route path="*" element={<DiscoverPage user={user} onSignIn={() => setShowAuth(true)} />} />
            </Routes>
          </RoutedErrorBoundary>
        </div>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        {needsProfileSetup && <ProfileSetup user={user} onComplete={(p) => setProfile(prev => ({ ...prev, ...p }))} />}
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
    </div>
  )
}
