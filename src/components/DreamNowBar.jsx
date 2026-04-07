// src/components/DreamNowBar.jsx
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const C = {
  bg: '#080B14', panel: '#0E1220',
  border: '#1E2A40', accent: '#7C5CFC',
  text: '#E8EAF0', muted: '#6B7494',
}

export default function DreamNowBar({ user }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    if (!value.trim()) { inputRef.current?.focus(); return }
    sessionStorage.setItem('ds_pending_prompt', value.trim())
    navigate('/create')
  }

  return (
    <div style={{ width: '100%', maxWidth: 680, margin: '0 auto 24px', padding: '0 16px' }}>
      <style>{`
        .dnb-wrap { transition: border-color 0.2s, box-shadow 0.2s; }
        .dnb-wrap:focus-within {
          border-color: rgba(124,92,252,0.35) !important;
          box-shadow: 0 4px 28px rgba(124,92,252,0.18) !important;
        }
        .dnb-btn { transition: all 0.18s ease; }
        .dnb-btn:hover  { filter: brightness(1.12); transform: scale(1.03); }
        .dnb-btn:active { transform: scale(0.97); }
        .dnb-input:focus { outline: none !important; box-shadow: none !important; }
      `}</style>
      <div className="dnb-wrap" style={{
        background: C.panel,
        border: `1.5px solid rgba(124,92,252,0.25)`,
        borderRadius: 18,
        padding: '5px 5px 5px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 4px 20px rgba(124,92,252,0.1)',
      }}>
        <span style={{ fontSize: 16, opacity: 0.5, flexShrink: 0, userSelect: 'none' }}>✦</span>
        <input
          ref={inputRef}
          className="dnb-input"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="What do you want to dream today?"
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            color: C.text,
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
            padding: '11px 0',
            minWidth: 0,
            caretColor: C.accent,
            WebkitAppearance: 'none',
          }}
        />
        <button
          className="dnb-btn"
          onClick={handleSubmit}
          style={{
            background: value.trim()
              ? `linear-gradient(135deg, #7C5CFC, #4B2FD0)`
              : `rgba(124,92,252,0.14)`,
            border: 'none',
            borderRadius: 13,
            padding: '10px 20px',
            color: value.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
            fontSize: 13,
            fontWeight: 700,
            cursor: value.trim() ? 'pointer' : 'default',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}>
          Dream Now ✦
        </button>
      </div>
    </div>
  )
}
