// src/components/AuthModal.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  text: '#E8EAF0', muted: '#6B7494', red: '#FF5E5E',
}

// ── Multi-account storage ─────────────────────────────────────────────────────
const ACCOUNTS_KEY = 'ds_saved_accounts'

export function getSavedAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]') } catch { return [] }
}

export function saveAccount({ id, email, username, displayName, avatarUrl }) {
  const accounts = getSavedAccounts()
  const idx = accounts.findIndex(a => a.id === id || a.email === email)
  const entry = { id, email, username, displayName, avatarUrl, lastUsed: Date.now() }
  if (idx >= 0) accounts[idx] = entry
  else accounts.unshift(entry)
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, 5)))
}

export function removeAccount(id) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(getSavedAccounts().filter(a => a.id !== id)))
}

// ── Google icon ───────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.705 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

// ── Account chip ──────────────────────────────────────────────────────────────
function AccountChip({ account, isActive, onSelect, onRemove }) {
  return (
    <div
      onClick={() => !isActive && onSelect(account)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, background: isActive ? `${C.accent}18` : C.card, border: `1px solid ${isActive ? C.accent + '55' : C.border}`, borderRadius: 12, padding: '10px 12px', cursor: isActive ? 'default' : 'pointer', transition: 'all 0.15s' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: account.avatarUrl ? 'transparent' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
        {account.avatarUrl
          ? <img src={account.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (account.username?.[0] || account.email?.[0] || '?').toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? C.accent : C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {account.displayName || account.username || account.email}
        </div>
        <div style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{account.email}</div>
      </div>
      {isActive
        ? <span style={{ fontSize: 10, color: C.accent, fontWeight: 700, flexShrink: 0 }}>Active ✓</span>
        : <button onClick={e => { e.stopPropagation(); onRemove(account.id) }} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 14, cursor: 'pointer', padding: '2px 6px', flexShrink: 0 }}>✕</button>}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function AuthModal({ onClose, prefilledEmail = '' }) {
  const [mode, setMode]         = useState('login')
  const [email, setEmail]       = useState(prefilledEmail)
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError]       = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [savedAccounts, setSavedAccounts] = useState([])
  const [showAccounts, setShowAccounts]   = useState(false)

  const { signIn, signUp, signInWithGoogle, user, profile } = useAuth()

  useEffect(() => {
    const accounts = getSavedAccounts()
    setSavedAccounts(accounts)
    if (accounts.length > 0 && !prefilledEmail) setShowAccounts(true)
  }, [])

  // Auto-save account when signed in
  useEffect(() => {
    if (user && profile) {
      saveAccount({ id: user.id, email: user.email, username: profile.username, displayName: profile.display_name, avatarUrl: profile.avatar_url })
    }
  }, [user?.id, profile?.username])

  const handleSubmit = async () => {
    setError(''); setLoading(true)
    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message.includes('Email not confirmed') ? 'Please confirm your email before signing in.'
          : error.message.includes('invalid_credentials') || error.message.includes('Invalid login') ? 'Incorrect email or password.'
          : error.message)
        setLoading(false)
      } else { onClose() }
    } else {
      if (!username.trim())                    { setError('Username is required.'); setLoading(false); return }
      if (username.length < 3)                 { setError('Username must be at least 3 characters.'); setLoading(false); return }
      if (!/^[a-zA-Z0-9_]+$/.test(username))  { setError('Letters, numbers, underscores only.'); setLoading(false); return }
      if (password.length < 6)                 { setError('Password must be at least 6 characters.'); setLoading(false); return }
      const { error } = await signUp(email, password, username)
      if (error) { setError(error.message); setLoading(false) }
      else setEmailSent(true)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) { setError('Please enter your email.'); return }
    setError(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://trydreamscape.com/reset-password' })
    if (error) { setError(error.message); setLoading(false) }
    else setResetSent(true)
  }

  const handleGoogle = async () => {
    setError(''); setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  const handleSwitchAccount = async (account) => {
    await supabase.auth.signOut()
    setShowAccounts(false)
    setEmail(account.email)
    setPassword('')
    setMode('login')
    setError('')
  }

  const handleRemoveAccount = (id) => {
    removeAccount(id)
    const updated = getSavedAccounts()
    setSavedAccounts(updated)
    if (updated.length === 0) setShowAccounts(false)
  }

  const inp = { padding: '11px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }
  const box = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '36px 40px', width: '100%', maxWidth: 420, boxShadow: `0 0 60px ${C.accent}22`, maxHeight: '90vh', overflowY: 'auto' }

  if (emailSent) return (
    <div style={overlay}>
      <div style={{ ...box, textAlign: 'center', padding: '48px 40px' }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>📬</div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, marginBottom: 12 }}>Check your email!</h2>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.8, marginBottom: 8 }}>Confirmation link sent to:</p>
        <p style={{ color: C.accent, fontSize: 15, fontWeight: 700, marginBottom: 32 }}>{email}</p>
        <button onClick={() => { setEmailSent(false); setMode('login') }} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>Go to Sign In</button>
        <button onClick={onClose} style={{ width: '100%', padding: '8px 0', background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  )

  if (resetSent) return (
    <div style={overlay}>
      <div style={{ ...box, textAlign: 'center', padding: '48px 40px' }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>🔑</div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, marginBottom: 12 }}>Reset link sent!</h2>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.8, marginBottom: 8 }}>Check your inbox at:</p>
        <p style={{ color: C.accent, fontSize: 15, fontWeight: 700, marginBottom: 32 }}>{email}</p>
        <button onClick={() => { setResetSent(false); setMode('login') }} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>Back to Sign In</button>
        <button onClick={onClose} style={{ width: '100%', padding: '8px 0', background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  )

  if (mode === 'forgot') return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={box}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>🔑</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'Playfair Display, serif' }}>Reset Password</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>We'll send a reset link to your email</div>
        </div>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" onKeyDown={e => e.key === 'Enter' && handleForgotPassword()} style={{ ...inp, marginBottom: 18 }} />
        {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 14, padding: '10px 12px', background: C.red + '18', borderRadius: 8 }}>{error}</div>}
        <button onClick={handleForgotPassword} disabled={loading} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: loading ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 12 }}>
          {loading ? 'Sending...' : 'Send Reset Link ✦'}
        </button>
        <button onClick={() => { setMode('login'); setError('') }} style={{ width: '100%', padding: '8px 0', background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>← Back to Sign In</button>
      </div>
    </div>
  )

  // ── Account switcher screen ───────────────────────────────────────────────
  if (showAccounts && savedAccounts.length > 0) return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={box}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>✦</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'Playfair Display, serif' }}>Welcome back</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Choose an account to continue</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {savedAccounts.map(account => (
            <AccountChip key={account.id} account={account} isActive={user?.id === account.id} onSelect={handleSwitchAccount} onRemove={handleRemoveAccount} />
          ))}
        </div>
        <button onClick={() => { setShowAccounts(false); setEmail(''); setPassword('') }} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: `1px solid ${C.border}`, background: 'none', color: C.muted, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
          + Use a different account
        </button>
        <button onClick={() => { setShowAccounts(false); setMode('signup'); setEmail('') }} style={{ width: '100%', padding: '8px 0', background: 'none', border: 'none', color: C.accent, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          Create new account
        </button>
        <button onClick={onClose} style={{ width: '100%', marginTop: 8, padding: '8px 0', background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )

  // ── Sign in / Sign up ─────────────────────────────────────────────────────
  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={box}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>✦</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'Playfair Display, serif' }}>Dreamscape</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{mode === 'login' ? 'Welcome back, artist' : 'Join the community'}</div>
        </div>

        {/* Saved accounts quick switcher */}
        {savedAccounts.length > 0 && mode === 'login' && (
          <button onClick={() => setShowAccounts(true)} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, cursor: 'pointer', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex' }}>
              {savedAccounts.slice(0, 3).map((a, i) => (
                <div key={a.id} style={{ width: 26, height: 26, borderRadius: '50%', background: a.avatarUrl ? 'transparent' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: `2px solid ${C.panel}`, overflow: 'hidden', marginLeft: i > 0 ? -8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                  {a.avatarUrl ? <img src={a.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (a.username?.[0] || '?').toUpperCase()}
                </div>
              ))}
            </div>
            <span style={{ flex: 1, textAlign: 'left', color: C.muted, fontSize: 12 }}>Switch account ({savedAccounts.length} saved)</span>
            <span style={{ color: C.muted, fontSize: 12 }}>→</span>
          </button>
        )}

        <div style={{ display: 'flex', background: C.card, borderRadius: 10, padding: 4, marginBottom: 24 }}>
          {['login','signup'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: mode === m ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : 'transparent', color: mode === m ? '#fff' : C.muted, fontSize: 13, fontWeight: 600, transition: 'all 0.2s' }}>
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <button onClick={handleGoogle} disabled={googleLoading} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: `1px solid ${C.border}`, background: googleLoading ? C.card : '#fff', color: googleLoading ? C.muted : '#3c4043', fontSize: 14, fontWeight: 600, cursor: googleLoading ? 'not-allowed' : 'pointer', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxSizing: 'border-box', fontFamily: 'inherit' }}>
          {googleLoading ? <span style={{ opacity: 0.5 }}>Redirecting to Google...</span> : <><GoogleIcon /><span>Continue with Google</span></>}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ fontSize: 11, color: C.muted }}>or</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          {mode === 'signup' && (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }}>@</span>
              <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))} placeholder="username" maxLength={30} style={{ ...inp, paddingLeft: 28 }} />
            </div>
          )}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" style={inp} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" onKeyDown={e => e.key === 'Enter' && handleSubmit()} style={inp} />
          {mode === 'signup' && <div style={{ fontSize: 11, color: C.muted }}>Minimum 6 characters</div>}
        </div>

        {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 14, padding: '10px 12px', background: C.red + '18', borderRadius: 8, lineHeight: 1.5 }}>{error}</div>}

        <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: loading ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', marginBottom: 14 }}>
          {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign In ✦' : 'Create Account ✦')}
        </button>

        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mode === 'login' && <>
            <button onClick={() => { setMode('forgot'); setError('') }} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Forgot your password?</button>
            <div style={{ fontSize: 12, color: C.muted }}>Don't have an account?{' '}<button onClick={() => { setMode('signup'); setError('') }} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Sign up free</button></div>
          </>}
          {mode === 'signup' && <div style={{ fontSize: 12, color: C.muted }}>Already have an account?{' '}<button onClick={() => { setMode('login'); setError('') }} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Sign in here</button></div>}
        </div>
        <button onClick={onClose} style={{ width: '100%', marginTop: 12, padding: '8px 0', background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}
