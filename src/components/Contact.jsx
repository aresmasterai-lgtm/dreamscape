import { useState } from 'react'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
}

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) return
    setSending(true)
    // Opens mailto as fallback — can be replaced with a serverless function later
    window.location.href = `mailto:support@trydreamscape.com?subject=${encodeURIComponent(form.subject || 'Dreamscape Inquiry')}&body=${encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`)}`
    setTimeout(() => { setSent(true); setSending(false) }, 500)
  }

  const inputStyle = { width: '100%', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.2s' }

  const CONTACTS = [
    { icon: '📧', label: 'General Support', value: 'support@trydreamscape.com', href: 'mailto:support@trydreamscape.com' },
    { icon: '👋', label: 'Say Hello', value: 'hello@trydreamscape.com', href: 'mailto:hello@trydreamscape.com' },
    { icon: '🔒', label: 'Privacy Inquiries', value: 'privacy@trydreamscape.com', href: 'mailto:privacy@trydreamscape.com' },
  ]

  return (
    <div style={{ padding: '60px 20px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Get In Touch</div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, color: C.text, marginBottom: 16 }}>Contact Us</h1>
        <p style={{ color: C.muted, fontSize: 16, maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>We're here to help. Reach out for support, partnerships, or just to say hello.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32 }}>
        {/* Contact form */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '32px' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 24 }}>Send a Message</h2>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text, marginBottom: 8 }}>Message sent!</h3>
              <p style={{ color: C.muted, fontSize: 14 }}>We'll get back to you within 24 hours.</p>
              <button onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }) }}
                style={{ marginTop: 20, background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 20px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Send another</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Name</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Your name" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} placeholder="your@email.com" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Subject</label>
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} style={inputStyle} placeholder="How can we help?" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Message</label>
                <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={5}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder="Tell us what's on your mind..." />
              </div>
              <button onClick={handleSubmit} disabled={sending || !form.name || !form.email || !form.message}
                style={{ background: (!form.name || !form.email || !form.message) ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '13px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: (!form.name || !form.email || !form.message) ? 'not-allowed' : 'pointer' }}>
                {sending ? 'Opening mail client...' : 'Send Message ✦'}
              </button>
            </div>
          )}
        </div>

        {/* Contact info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {CONTACTS.map(c => (
            <a key={c.label} href={c.href} style={{ textDecoration: 'none', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '55'}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>{c.icon}</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 14, color: C.accent, fontWeight: 600 }}>{c.value}</div>
              </div>
            </a>
          ))}

          {/* Response time */}
          <div style={{ background: `${C.teal}12`, border: `1px solid ${C.teal}33`, borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.teal, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>⚡ Response Time</div>
            <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7, margin: 0 }}>We typically respond within 24 hours on business days. For urgent issues, include "URGENT" in your subject line.</p>
          </div>

          {/* FAQ link */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Before you write</div>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 14 }}>Many questions are answered in our blog guides and documentation.</p>
            <a href="/blog" style={{ display: 'inline-block', background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: '8px 18px', color: C.accent, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Browse Help Articles →</a>
          </div>
        </div>
      </div>
    </div>
  )
}
