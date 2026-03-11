import { useState } from 'react'
import { useAuth } from '../lib/auth'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  text: '#E8EAF0', muted: '#6B7494', red: '#FF5E5E',
}

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { signIn, signUp, signInWithGoogle } = useAuth()

  const handleSubmit = async () => {
    setError('')
    setSuccess('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error.message)
      else onClose()
    } else {
      if (!username.trim()) {
        setError('Username is required')
        setLoading(false)
        return
      }
      const { error } = await signUp(email, password, username)
      if (error) setError(error.message)
      else setSuccess('Check your email to confirm your account!')
    }

    setLoading(false)
  }

  const handleGoogle = async () => {
    setError('')
    const { error } = await signInWithGoogle()
    if (error) setError(error.message)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20
    }}>
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 20, padding: '36px 40px', width: '100%', maxWidth: 420,
        boxShadow: `0 0 60px ${C.accent}22`
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px',
            background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
          }}>✦</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'Playfair Display, serif' }}>Dreamscape</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {mode === 'login' ? 'Welcome back, artist' : 'Join the community'}
          </div>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', background: C.card, borderRadius: 10, padding: 4, marginBottom: 24 }}>
          {['login', 'signup'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: mode === m ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : 'transparent',
              color: mode === m ? '#fff' : C.muted, fontSize: 13, fontWeight: 600,
              transition: 'all 0.2s'
            }}>{m === 'login' ? 'Sign In' : 'Sign Up'}</button>
          ))}
        </div>

        {/* Google Button */}
        <button onClick={handleGoogle} style={{
          width: '100%', padding: '11px 0', borderRadius: 10, border: `1px solid ${C.border}`,
          background: C.card, color: C.text, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', marginBottom: 18, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8
        }}>
          <span style={{ fontSize: 16 }}>G</span> Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ fontSize: 11, color: C.muted }}>or</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          {mode === 'signup' && (
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              style={{ padding: '11px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, outline: 'none' }}
            />
          )}
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            style={{ padding: '11px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, outline: 'none' }}
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ padding: '11px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, outline: 'none' }}
          />
        </div>

        {/* Error / Success */}
        {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 14, padding: '8px 12px', background: C.red + '18', borderRadius: 8 }}>{error}</div>}
        {success && <div style={{ fontSize: 12, color: C.teal, marginBottom: 14, padding: '8px 12px', background: C.teal + '18', borderRadius: 8 }}>{success}</div>}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
          background: loading ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`,
          color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s'
        }}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        {/* Close */}
        <button onClick={onClose} style={{
          width: '100%', marginTop: 12, padding: '8px 0', background: 'none',
          border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer'
        }}>Cancel</button>
      </div>
    </div>
  )
}
