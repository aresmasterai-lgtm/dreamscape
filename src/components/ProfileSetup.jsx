import { useState } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  text: '#E8EAF0', muted: '#6B7494',
}

export default function ProfileSetup({ user, onComplete }) {
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!username.trim()) return setError('Username is required.')
    if (username.length < 3) return setError('Username must be at least 3 characters.')
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return setError('Letters, numbers, and underscores only.')

    setLoading(true)
    setError('')

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .single()

    if (existing) {
      setLoading(false)
      return setError('That username is already taken. Try another.')
    }

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        updated_at: new Date().toISOString(),
      })

    setLoading(false)

    if (upsertError) {
      setError('Something went wrong. Please try again.')
    } else {
      onComplete({ username: username.trim().toLowerCase(), bio: bio.trim() })
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(8,11,20,0.95)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 20,
        padding: '40px 36px', maxWidth: 460, width: '100%',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, margin: '0 auto 16px',
          }}>✦</div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, color: C.text, marginBottom: 8 }}>
            Welcome to Dreamscape
          </h2>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6 }}>
            Set up your artist profile to get started.
          </p>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            Username
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 14 }}>@</span>
            <input
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              placeholder="yourartistname"
              maxLength={30}
              style={{
                width: '100%', background: C.bg,
                border: `1px solid ${error ? '#ff6b6b' : C.border}`,
                borderRadius: 10, padding: '11px 14px 11px 28px',
                color: C.text, fontSize: 14, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            Bio <span style={{ color: C.muted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Tell the world about your art..."
            maxLength={160}
            rows={3}
            style={{
              width: '100%', background: C.bg, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '11px 14px', color: C.text,
              fontSize: 14, outline: 'none', fontFamily: 'inherit',
              resize: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 4 }}>{bio.length}/160</div>
        </div>

        {error && (
          <div style={{ background: '#ff6b6b18', border: '1px solid #ff6b6b44', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#ff6b6b' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !username.trim()}
          style={{
            width: '100%',
            background: loading || !username.trim() ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`,
            border: 'none', borderRadius: 10, padding: '13px',
            color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: loading || !username.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {loading ? 'Setting up...' : 'Enter Dreamscape ✦'}
        </button>
      </div>
    </div>
  )
}
