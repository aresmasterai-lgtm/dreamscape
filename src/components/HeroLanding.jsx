// src/components/HeroLanding.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494', red: '#FF4D4D',
}

const PLACEHOLDERS = [
  'a golden dragon soaring through neon Tokyo at midnight…',
  'a lone astronaut painting the rings of Saturn…',
  'an enchanted forest where trees grow crystal flowers…',
  'a cyberpunk samurai reflected in a rainy puddle…',
  'a melting clock draped over a floating island…',
  'a whale swimming through clouds above ancient ruins…',
  'a girl made of stardust reading under a blood moon…',
]

const CHIPS = [
  'Neon cityscape', 'Fantasy portrait', 'Abstract cosmos',
  'Surreal landscape', 'Vintage poster', 'Dark fantasy',
]

export default function HeroLanding({ onSignIn }) {
  const navigate  = useNavigate()
  const inputRef  = useRef(null)
  const [value, setValue]     = useState('')
  const [shake, setShake]     = useState(false)
  const [phIdx, setPhIdx]     = useState(0)
  const [phVisible, setPhVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 500)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setPhVisible(false)
      setTimeout(() => {
        setPhIdx(i => (i + 1) % PLACEHOLDERS.length)
        setPhVisible(true)
      }, 300)
    }, 3800)
    return () => clearInterval(t)
  }, [])

  const handleSubmit = () => {
    if (!value.trim()) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      inputRef.current?.focus()
      return
    }
    sessionStorage.setItem('ds_pending_prompt', value.trim())
    onSignIn()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 20px 60px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes gradientShift {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes orb1 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(40px,-30px) scale(1.08); }
        }
        @keyframes orb2 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(-30px,40px) scale(1.1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bubbleIdle {
          0%,100% { box-shadow: 0 0 0 0 rgba(124,92,252,0), 0 8px 48px rgba(124,92,252,0.2); }
          50%      { box-shadow: 0 0 0 8px rgba(124,92,252,0.07), 0 8px 64px rgba(124,92,252,0.4); }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-8px); }
          40%     { transform: translateX(8px); }
          60%     { transform: translateX(-5px); }
          80%     { transform: translateX(5px); }
        }
        @keyframes logoGlow {
          0%,100% { box-shadow: 0 0 20px rgba(124,92,252,0.4), 0 4px 20px rgba(0,0,0,0.4); }
          50%      { box-shadow: 0 0 40px rgba(124,92,252,0.7), 0 0 20px rgba(0,212,170,0.2), 0 4px 20px rgba(0,0,0,0.4); }
        }
        .hl-fadein-1 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both; animation-delay: 0.05s; opacity: 0; }
        .hl-fadein-2 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both; animation-delay: 0.2s;  opacity: 0; }
        .hl-fadein-3 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both; animation-delay: 0.38s; opacity: 0; }
        .hl-fadein-4 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both; animation-delay: 0.55s; opacity: 0; }
        .hl-fadein-5 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both; animation-delay: 0.7s;  opacity: 0; }
        .hl-bubble { animation: bubbleIdle 3.5s ease-in-out infinite; }
        .hl-bubble:focus-within {
          animation: none !important;
          border-color: rgba(124,92,252,0.35) !important;
          box-shadow: 0 8px 40px rgba(124,92,252,0.2) !important;
        }
        .hl-shake { animation: shake 0.45s ease !important; }
        .hl-logo  { animation: logoGlow 3s ease-in-out infinite; }
        .hl-dream-btn { transition: all 0.2s ease; }
        .hl-dream-btn:hover  { filter: brightness(1.15); transform: scale(1.04); }
        .hl-dream-btn:active { transform: scale(0.96); }
        .hl-chip { transition: all 0.15s ease; }
        .hl-chip:hover { border-color: rgba(124,92,252,0.55) !important; color: #E8EAF0 !important; background: rgba(124,92,252,0.12) !important; }
        .hl-ghost:hover { border-color: rgba(124,92,252,0.4) !important; color: #E8EAF0 !important; }
        .hl-ph { transition: opacity 0.3s ease, transform 0.3s ease; }
      `}</style>

      {/* Ambient background orbs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: `radial-gradient(circle, rgba(124,92,252,0.1) 0%, transparent 70%)`, top: '-15%', left: '-10%', animation: 'orb1 14s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 450, height: 450, borderRadius: '50%', background: `radial-gradient(circle, rgba(0,212,170,0.08) 0%, transparent 70%)`, bottom: '-5%', right: '0%', animation: 'orb2 18s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, rgba(255,107,157,0.06) 0%, transparent 70%)`, top: '35%', right: '15%', animation: 'orb1 22s ease-in-out infinite reverse' }} />
      </div>

      {/* Logo */}
      <div className="hl-fadein-1" style={{ marginBottom: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="hl-logo" style={{
          width: 68, height: 68, borderRadius: 20,
          background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30, color: '#fff',
        }}>✦</div>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: '-0.3px' }}>Dreamscape</div>
      </div>

      {/* Headline */}
      <div className="hl-fadein-2" style={{ textAlign: 'center', marginBottom: 44 }}>
        <h1 style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: 'clamp(30px, 5.5vw, 58px)',
          fontWeight: 900,
          lineHeight: 1.08,
          color: C.text,
          margin: '0 0 14px',
        }}>
          What will you{' '}
          <span style={{
            background: `linear-gradient(135deg, ${C.accent}, ${C.teal}, #FF6B9D, ${C.gold}, ${C.accent})`,
            backgroundSize: '300% 300%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            animation: 'gradientShift 6s ease infinite',
          }}>dream</span>{' '}today?
        </h1>
        <p style={{ fontSize: 'clamp(14px, 1.8vw, 17px)', color: C.muted, lineHeight: 1.65, margin: 0 }}>
          Describe it. Dream AI creates it. Sell it worldwide.
        </p>
      </div>

      {/* THE BUBBLE */}
      <div className={`hl-fadein-3 hl-bubble${shake ? ' hl-shake' : ''}`} style={{
        width: '100%',
        maxWidth: 660,
        background: C.panel,
        border: `1.5px solid rgba(124,92,252,0.28)`,
        borderRadius: 26,
        padding: '7px 7px 7px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        position: 'relative',
      }}>
        <span style={{ fontSize: 20, flexShrink: 0, opacity: 0.55, userSelect: 'none' }}>✦</span>

        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {!value && (
            <div className="hl-ph" style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              left: 0,
              right: 0,
              pointerEvents: 'none',
              color: C.muted,
              fontSize: 'clamp(13px, 1.8vw, 15px)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: phVisible ? 1 : 0,
            }}>
              Imagine {PLACEHOLDERS[phIdx]}
            </div>
          )}
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder=""
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              outline: 'none',
              color: C.text,
              fontSize: 'clamp(13px, 1.8vw, 15px)',
              fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.5,
              padding: '14px 0',
              minWidth: 0,
              caretColor: C.accent,
            }}
          />
        </div>

        <button
          className="hl-dream-btn"
          onClick={handleSubmit}
          style={{
            background: value.trim()
              ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)`
              : `rgba(124,92,252,0.18)`,
            border: 'none',
            borderRadius: 20,
            padding: 'clamp(11px,2vw,14px) clamp(18px,3vw,26px)',
            color: value.trim() ? '#fff' : 'rgba(255,255,255,0.35)',
            fontSize: 'clamp(13px, 1.5vw, 15px)',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            letterSpacing: '0.2px',
          }}>
          Dream Now ✦
        </button>
      </div>

      {/* Inspiration chips */}
      <div className="hl-fadein-4" style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 600,
        marginBottom: 52,
      }}>
        {CHIPS.map(chip => (
          <button
            key={chip}
            className="hl-chip"
            onClick={() => { setValue(chip); setTimeout(() => inputRef.current?.focus(), 0) }}
            style={{
              background: `rgba(124,92,252,0.07)`,
              border: `1px solid rgba(124,92,252,0.18)`,
              borderRadius: 20,
              padding: '6px 15px',
              color: C.muted,
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}>
            {chip}
          </button>
        ))}
      </div>

      {/* Secondary CTAs */}
      <div className="hl-fadein-5" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="hl-ghost" onClick={() => navigate('/marketplace')}
          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 22px', color: C.muted, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'DM Sans', sans-serif" }}>
          Browse Marketplace
        </button>
        <span style={{ color: C.border }}>·</span>
        <button className="hl-ghost" onClick={() => navigate('/pricing')}
          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 22px', color: C.muted, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'DM Sans', sans-serif" }}>
          View Pricing
        </button>
      </div>
    </div>
  )
}
