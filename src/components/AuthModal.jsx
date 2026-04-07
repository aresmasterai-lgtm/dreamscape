import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  text: '#E8EAF0', muted: '#6B7494', red: '#FF5E5E',
}

// Google's actual G logo SVG
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function AuthModal({ onClose }) {
  const [mode, setMode]         = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError]       = useState('')
  const [emailSent, setEmailSent]   = useState(false)
  const [resetSent, setResetSent]   = useState(false)

  const { signIn, signUp, signInWithGoogle } = useAuth()

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) {
        if (error.message.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link before signing in.')
        } else if (error.message.includes('Invalid login') || error.message.includes('invalid_credentials')) {
          setError('Incorrect email or password. Please try again.')
        } else {
          setError(error.message)
        }
        setLoading(false)
      } else {
        onClose()
      }
    } else if (mode === 'signup') {
      if (!username.trim())           { setError('Username is required.');                           setLoading(false); return }
      if (username.length < 3)        { setError('Username must be at least 3 characters.');         setLoading(false); return }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError('Username: letters, numbers, and underscores only.'); setLoading(false); return }
      if (password.length < 6)        { setError('Password must be at least 6 characters.');         setLoading(false); return }
      const { error } = await signUp(email, password, username)
      if (error) { setError(error.message); setLoading(false) }
      else setEmailSent(true)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://trydreamscape.com/reset-password',
    })
    if (error) { setError(error.message); setLoading(false) }
    else setResetSent(true)
  }

  const handleGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    // signInWithGoogle triggers a redirect — no need to setLoading(false)
    // because the page navigates away. If it errors, we catch it.
    const { error } = await signInWithGoogle()
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
    // If no error: browser is redirecting to Google — component will unmount
  }

  const inp = {
    padding: '11px 14px', borderRadius: 10,
    border: `1px solid ${C.border}`, background: C.card,
    color: C.text, fontSize: 13, outline: 'none',
    width: '100%', boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20,
  }
  const box = {
    background: C.panel, border: `1px solid ${C.border}`,
    borderRadius: 20, padding: '36px 40px',
    width: '100%', maxWidth: 420,
    boxShadow: `0 0 60px ${C.accent}22`,
  }

  // ── Email confirmation sent ───────────────────────────────────────────────
  if (emailSent) return (
    <div style={overlay}>
      <div style={{ ...box, textAlign: 'center', padding: '48px 40px' }}>
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

  // ── Password reset sent ───────────────────────────────────────────────────
  if (resetSent) return (
    <div style={overlay}>
      <div style={{ ...box, textAlign: 'center', padding: '48px 40px' }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>🔑</div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, marginBottom: 12 }}>Reset link sent!</h2>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.8, marginBottom: 8 }}>We sent a password reset link to:</p>
        <p style={{ color: C.accent, fontSize: 15, fontWeight: 700, marginBottom: 20 }}>{email}</p>
        <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.8, marginBottom: 32 }}>Click the link to set a new password. Check your spam folder if you don't see it.</p>
        <button onClick={() => { setResetSent(false); setMode('login') }}
          style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
          Back to Sign In
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: '8px 0', background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  )

  // ── Forgot password ───────────────────────────────────────────────────────
  if (mode === 'forgot') return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={box}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>🔑</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'Playfair Display, serif' }}>Reset Password</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>We'll send a reset link to your email</div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email address" onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
            style={inp} />
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

  // ── Main login / signup ───────────────────────────────────────────────────
  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={box}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>✦</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'Playfair Display, serif' }}>Dreamscape</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {mode === 'login' ? 'Welcome back, artist' : 'Join the community'}
          </div>
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', background: C.card, borderRadius: 10, padding: 4, marginBottom: 24 }}>
          {['login', 'signup'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: mode === m ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : 'transparent', color: mode === m ? '#fff' : C.muted, fontSize: 13, fontWeight: 600, transition: 'all 0.2s' }}>
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Google button */}
        <button onClick={handleGoogle} disabled={googleLoading}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: googleLoading ? C.card : '#fff',
            color: googleLoading ? C.muted : '#3c4043',
            fontSize: 14, fontWeight: 600, cursor: googleLoading ? 'not-allowed' : 'pointer',
            marginBottom: 18, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 10, boxSizing: 'border-box',
            transition: 'all 0.2s', fontFamily: 'inherit',
          }}>
          {googleLoading
            ? <><span style={{ opacity: 0.5 }}>Redirecting to Google</span><span style={{ opacity: 0.5 }}>...</span></>
            : <><GoogleIcon /><span>Continue with Google</span></>}
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
                style={{ ...inp, paddingLeft: 28 }} />
            </div>
          )}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email address" style={inp} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inp} />
          {mode === 'signup' && (
            <div style={{ fontSize: 11, color: C.muted }}>Minimum 6 characters</div>
          )}
        </div>

        {error && (
          <div style={{ fontSize: 12, color: C.red, marginBottom: 14, padding: '10px 12px', background: C.red + '18', borderRadius: 8, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={loading}
          style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: loading ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', marginBottom: 14 }}>
          {loading
            ? mode === 'login' ? 'Signing in...' : 'Creating account...'
            : mode === 'login' ? 'Sign In ✦' : 'Create Account ✦'}
        </button>

        {/* Footer links */}
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
                  Sign up free
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
