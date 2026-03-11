import { useState } from 'react'
import { useAuth } from './lib/auth'
import AuthModal from './components/AuthModal'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
}

export default function App() {
  const { user, profile, signOut, loading } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [activeNav, setActiveNav] = useState('discover')

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.accent, fontSize: 32 }}>✦</div>
      </div>
    )
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@700;900&display=swap');`}</style>

      {/* Navbar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(8,11,20,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`, height: 64,
        display: 'flex', alignItems: 'center', padding: '0 32px', gap: 32
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✦</div>
          <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: 18, color: C.text }}>Dreamscape</span>
        </div>

        {/* Nav Links */}
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {[['discover', 'Discover'], ['channels', 'Channels'], ['marketplace', 'Marketplace'], ['create', 'Create']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveNav(id)} style={{
              background: activeNav === id ? `${C.accent}20` : 'none',
              border: `1px solid ${activeNav === id ? C.accent + '55' : 'transparent'}`,
              borderRadius: 8, padding: '6px 14px', color: activeNav === id ? C.accent : C.muted,
              fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s'
            }}>{label}</button>
          ))}
        </div>

        {/* Auth Area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                  {profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                  {profile?.username || user.email?.split('@')[0]}
                </span>
              </div>
              <button onClick={signOut} style={{
                background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '6px 14px', color: C.muted, fontSize: 13, cursor: 'pointer'
              }}>Sign Out</button>
            </>
          ) : (
            <>
              <button onClick={() => setShowAuth(true)} style={{
                background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '6px 14px', color: C.muted, fontSize: 13, cursor: 'pointer'
              }}>Sign In</button>
              <button onClick={() => setShowAuth(true)} style={{
                background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none',
                borderRadius: 8, padding: '7px 16px', color: '#fff', fontSize: 13,
                fontWeight: 600, cursor: 'pointer'
              }}>Join Free</button>
            </>
          )}
        </div>
      </nav>

      {/* Page Content */}
      <div style={{ paddingTop: 64 }}>

        {/* DISCOVER */}
        {activeNav === 'discover' && (
          <div>
            {/* Hero */}
            <div style={{ minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px', position: 'relative', overflow: 'hidden' }}>
              {/* Background orbs */}
              <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}18 0%, transparent 70%)`, top: '10%', left: '20%', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${C.teal}12 0%, transparent 70%)`, bottom: '10%', right: '15%', pointerEvents: 'none' }} />

              <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}>AI-Powered Artist Platform</div>
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(42px, 8vw, 88px)', fontWeight: 900, lineHeight: 1.05, marginBottom: 24, maxWidth: 800 }}>
                Where Artists<br />
                <span style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.teal})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Create & Thrive</span>
              </h1>
              <p style={{ fontSize: 18, color: C.muted, maxWidth: 520, lineHeight: 1.7, marginBottom: 40 }}>
                Generate stunning artwork with AI, connect with artists worldwide, and sell merchandise globally — all in one platform.
              </p>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => setShowAuth(true)} style={{
                  background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none',
                  borderRadius: 12, padding: '14px 32px', color: '#fff', fontSize: 15,
                  fontWeight: 700, cursor: 'pointer'
                }}>Start Creating Free ✦</button>
                <button onClick={() => setActiveNav('marketplace')} style={{
                  background: 'none', border: `1px solid ${C.border}`, borderRadius: 12,
                  padding: '14px 32px', color: C.text, fontSize: 15, cursor: 'pointer'
                }}>Explore Marketplace</button>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 48, marginTop: 64, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[['10K+', 'Artists'], ['50K+', 'Artworks'], ['120+', 'Channels'], ['150+', 'Countries']].map(([num, label]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: C.text, fontFamily: 'Playfair Display, serif' }}>{num}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CHANNELS */}
        {activeNav === 'channels' && (
          <div style={{ padding: '40px 32px', maxWidth: 900, margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, marginBottom: 8 }}>Channels</h2>
            <p style={{ color: C.muted, marginBottom: 32 }}>Join conversations with artists around the world.</p>
            {!user && (
              <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '20px 24px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <span style={{ fontSize: 14, color: C.text }}>Sign in to post and join the conversation</span>
                <button onClick={() => setShowAuth(true)} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '8px 18px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sign In</button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {[['🎨', 'surrealism', 'Surrealism', '4.8K'], ['⚡', 'ai-generation', 'AI Generation', '9.1K'], ['🌍', 'afrofuturism', 'Afrofuturism', '6.5K'], ['🌊', 'vaporwave', 'Vaporwave', '2.9K'], ['🛒', 'product-drops', 'Product Drops', '8.3K'], ['🤝', 'collabs-wanted', 'Collabs Wanted', '2.2K']].map(([icon, id, name, members]) => (
                <div key={id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '55'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                  <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>#{name}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{members} members</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MARKETPLACE */}
        {activeNav === 'marketplace' && (
          <div style={{ padding: '40px 32px', maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, marginBottom: 8 }}>Marketplace</h2>
            <p style={{ color: C.muted, marginBottom: 32 }}>Original art on premium products, shipped worldwide.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {[['Cosmic Dreams Tee', '$34', '🌌'], ['Afrofuture Hoodie', '$65', '🚀'], ['Surreal Poster', '$28', '🎨'], ['Dream Mug', '$22', '☕'], ['Vaporwave Print', '$45', '🌊'], ['Abstract Phone Case', '$19', '📱']].map(([name, price, icon]) => (
                <div key={name} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  <div style={{ height: 180, background: `linear-gradient(135deg, ${C.accent}22, ${C.teal}22)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>{icon}</div>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>{name}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.accent }}>{price}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CREATE */}
        {activeNav === 'create' && (
          <div style={{ padding: '40px 32px', maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 20 }}>🎨</div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 36, marginBottom: 12 }}>Create with AI</h2>
            <p style={{ color: C.muted, fontSize: 16, lineHeight: 1.7, marginBottom: 32 }}>Describe your vision and let Ares generate stunning artwork. Apply it to 300+ products and start selling globally.</p>
            {user ? (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
                <textarea placeholder="Describe your artwork... e.g. 'A surreal dreamscape with floating islands and bioluminescent trees'" style={{ width: '100%', minHeight: 120, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, color: C.text, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                <button style={{ marginTop: 14, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '12px 28px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Generate with Ares ✦</button>
              </div>
            ) : (
              <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 16, padding: 32 }}>
                <p style={{ color: C.text, marginBottom: 20, fontSize: 15 }}>Sign in to start creating AI artwork</p>
                <button onClick={() => setShowAuth(true)} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '12px 28px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Sign In to Create ✦</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auth Modal */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}
