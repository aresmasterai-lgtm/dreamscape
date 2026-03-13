import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  text: '#E8EAF0', muted: '#6B7494', red: '#FF5E5E',
}

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const { signIn, signUp, signInWithGoogle } = useAuth()

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) {
        if (error.message.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link before signing in.')
        } else if (error.message.includes('Invalid login')) {
          setError('Incorrect email or password. Please try again.')
        } else {
          setError(error.message)
        }
      } else {
        onClose()
      }
    } else if (mode === 'signup') {
      if (!username.trim()) { setError('Username is required.'); setLoading(false); return }
      if (username.length < 3) { setError('Username must be at least 3 characters.'); setLoading(false); return }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError('Username: letters, numbers, and underscores only.'); setLoading(false); return }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return }
      const { error } = await signUp(email, password, username)
      if (error) setError(error.message)
      else setEmailSent(true)
    }

    setLoading(false)
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://trydreamscape.com/reset-password',
    })
    if (error) setError(error.message)
    else setResetSent(true)
    setLoading(false)
  }

  const handleGoogle = async () => {
    setError('')
    const { error } = await signInWithGoogle()
    if (error) setError(error.message)
  }

  const inputStyle = {
    padding: '11px 14px', borderRadius: 10,
    border: `1px solid ${C.border}`, background: C.card,
    color: C.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  // ── Email confirmation sent screen ───────────────────────────
  if (emailSent) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '48px 40px', width: '100%', maxWidth: 420, textAlign: 'center', boxShadow: `0 0 60px ${C.accent}22` }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>📬</div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, marginBottom: 12 }}>Check your email!</h2>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.8, marginBottom: 8 }}>We sent a confirmation link to:</p>
        <p style={{ color: C.accent, fontSize: 15, fontWeight: 700, marginBottom: 20 }}>{email}</p>
        <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.8, marginBottom: 32 }}>Click the link in the email to activate your account, then come back and sign in.</p>
        <button onClick={() => { setEmailSent(false); setMode('login') }}
          style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
          Go to Sign In
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: '8px 0', background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  )

  // ── Password reset sent screen ───────────────────────────────
  if (resetSent) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '48px 40px', width: '100%', maxWidth: 420, textAlign: 'center', boxShadow: `0 0 60px ${C.accent}22` }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>🔑</div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, marginBottom: 12 }}>Reset link sent!</h2>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.8, marginBottom: 8 }}>We sent a password reset link to:</p>
        <p style={{ color: C.accent, fontSize: 15, fontWeight: 700, marginBottom: 20 }}>{email}</p>
        <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.8, marginBottom: 32 }}>Check your inbox and click the link to set a new password. Check your spam folder if you don't see it.</p>
        <button onClick={() => { setResetSent(false); setMode('login') }}
          style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
          Back to Sign In
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: '8px 0', background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  )

  // ── Forgot password screen ───────────────────────────────────
  if (mode === 'forgot') return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '36px 40px', width: '100%', maxWidth: 420, boxShadow: `0 0 60px ${C.accent}22` }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>🔑</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'Playfair Display, serif' }}>Reset Password</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Enter your email and we'll send you a reset link</div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email address" onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
            style={inputStyle} />
        </div>
        {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 14, padding: '10px 12px', background: C.red + '18', borderRadius: 8, lineHeight: 1.5 }}>{error}</div>}
        <button onClick={handleForgotPassword} disabled={loading}
          style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: loading ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 12 }}>
          {loading ? 'Sending...' : 'Send Reset Link ✦'}
        </button>
        <button onClick={() => { setMode('login'); setError('') }}
          style={{ width: '100%', padding: '8px 0', background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
          ← Back to Sign In
        </button>
      </div>
    </div>
  )

  // ── Main login / signup screen ───────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '36px 40px', width: '100%', maxWidth: 420, boxShadow: `0 0 60px ${C.accent}22` }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>✦</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'Playfair Display, serif' }}>Dreamscape</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{mode === 'login' ? 'Welcome back, artist' : 'Join the community'}</div>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', background: C.card, borderRadius: 10, padding: 4, marginBottom: 24 }}>
          {['login', 'signup'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: mode === m ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : 'transparent', color: mode === m ? '#fff' : C.muted, fontSize: 13, fontWeight: 600, transition: 'all 0.2s' }}>
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Google */}
        <button onClick={handleGoogle}
          style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box' }}>
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
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }}>@</span>
              <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username" maxLength={30}
                style={{ ...inputStyle, paddingLeft: 28 }} />
            </div>
          )}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email address" style={inputStyle} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inputStyle} />
          {mode === 'signup' && (
            <div style={{ fontSize: 11, color: C.muted }}>Minimum 6 characters</div>
          )}
        </div>

        {/* Error */}
        {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 14, padding: '10px 12px', background: C.red + '18', borderRadius: 8, lineHeight: 1.5 }}>{error}</div>}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={loading}
          style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: loading ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', marginBottom: 14 }}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In ✦' : 'Create Account ✦'}
        </button>

        {/* Forgot password / switch mode prompts */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mode === 'login' && (
            <>
              <button onClick={() => { setMode('forgot'); setError('') }}
                style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
                Forgot your password?
              </button>
              <div style={{ fontSize: 12, color: C.muted }}>
                Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); setError('') }}
                  style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  Sign up for free
                </button>
              </div>
            </>
          )}
          {mode === 'signup' && (
            <div style={{ fontSize: 12, color: C.muted }}>
              Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError('') }}
                style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                Sign in here
              </button>
            </div>
          )}
        </div>

        <button onClick={onClose}
          style={{ width: '100%', marginTop: 12, padding: '8px 0', background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
