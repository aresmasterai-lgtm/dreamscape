import { Link } from 'react-router-dom'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
}

const sections = [
  {
    title: 'Create & Discover',
    icon: '✦',
    links: [
      { label: 'Discover', path: '/', desc: 'The Dreamscape home — start your journey' },
      { label: 'Create with Dream AI', path: '/create', desc: 'Generate AI artwork with your AI creative companion' },
      { label: 'Gallery', path: '/gallery', desc: 'Explore AI-generated artwork from the community' },
      { label: 'Marketplace', path: '/marketplace', desc: 'Shop unique AI-designed merchandise worldwide' },
      { label: 'Blog', path: '/blog', desc: 'Prompting guides, tips and creator inspiration' },
    ],
  },
  {
    title: 'Account & Billing',
    icon: '👤',
    links: [
      { label: 'My Profile', path: '/profile', desc: 'Your artist profile, artwork and shop' },
      { label: 'My Orders', path: '/orders', desc: 'Track your purchases and order history' },
      { label: 'Pricing', path: '/pricing', desc: 'Free, Starter, Pro and Studio plans' },
    ],
  },
  {
    title: 'Legal & Support',
    icon: '📋',
    links: [
      { label: 'Privacy Policy', path: '/privacy', desc: 'How we collect and protect your data' },
      { label: 'Terms of Service', path: '/terms', desc: 'Rules and guidelines for using Dreamscape' },
      { label: 'Contact Us', path: '/contact', desc: 'Get help or just say hello' },
      { label: 'Sitemap', path: '/sitemap', desc: 'All pages on Dreamscape' },
    ],
  },
]

export default function Sitemap() {
  return (
    <div style={{ padding: '60px 20px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Navigation</div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, color: C.text, marginBottom: 12 }}>Sitemap</h1>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>A complete overview of all pages on Dreamscape.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
        {sections.map(section => (
          <div key={section.title} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 20 }}>{section.icon}</span>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text, margin: 0 }}>{section.title}</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {section.links.map(link => (
                <Link key={link.path} to={link.path} style={{ textDecoration: 'none', display: 'block', padding: '10px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, transition: 'border-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '55'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, marginBottom: 3 }}>{link.label}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{link.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', fontSize: 13, color: C.muted, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>🤖</span>
        <span>Looking for the XML sitemap for search engines? <a href="/sitemap.xml" style={{ color: C.accent, textDecoration: 'none' }}>sitemap.xml</a></span>
      </div>
    </div>
  )
}
