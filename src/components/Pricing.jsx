import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
}

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    color: C.muted,
    description: 'Get started and explore',
    features: [
      '10 AI generations/month',
      'Up to 3 products listed',
      'View & post in Channels',
      'Basic artist profile',
      '30% Dreamscape commission',
      'Community support',
    ],
    cta: 'Get Started',
    highlight: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 9.99,
    color: C.teal,
    description: 'For emerging artists',
    features: [
      '50 AI generations/month',
      'Up to 15 products listed',
      'Post & join Channels',
      'Payout setup enabled',
      '25% Dreamscape commission',
      'Email support',
    ],
    cta: 'Start Selling',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 24.99,
    color: C.accent,
    description: 'For serious creators',
    features: [
      '200 AI generations/month',
      'Up to 50 products listed',
      'Create your own Channels',
      'Featured marketplace listings',
      '20% Dreamscape commission',
      'Full analytics dashboard',
      'Priority email support',
    ],
    cta: 'Go Pro',
    highlight: true,
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 59.99,
    color: C.gold,
    description: 'For professional studios',
    features: [
      'Unlimited AI generations',
      'Unlimited products listed',
      'Create your own Channels',
      'Featured marketplace listings',
      '15% Dreamscape commission',
      'Full analytics + data export',
      'Dedicated support',
    ],
    cta: 'Go Studio',
    highlight: false,
  },
]

export default function Pricing({ user, onSignIn }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(null)

  const handleSubscribe = async (tier) => {
    if (!user) { onSignIn(); return }
    if (tier.id === 'free') { navigate('/profile'); return }
    setLoading(tier.id)
    try {
      const res = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tier.id, userId: user.id, email: user.email }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Something went wrong: ' + (data.error || 'Unknown error'))
    } catch (err) {
      alert('Connection error.')
    }
    setLoading(null)
  }

  return (
    <div style={{ padding: '60px 20px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Pricing</div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, color: C.text, marginBottom: 16, lineHeight: 1.1 }}>
          Choose Your Creative Plan
        </h1>
        <p style={{ color: C.muted, fontSize: 16, maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
          Start free, upgrade when you're ready to sell. Every plan includes access to Dream AI and the Dreamscape marketplace.
        </p>
      </div>

      {/* Tier cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 60 }}>
        {TIERS.map(tier => (
          <div key={tier.id} style={{
            background: tier.highlight ? `linear-gradient(160deg, ${C.accent}22, ${C.card})` : C.card,
            border: `1px solid ${tier.highlight ? C.accent + '66' : C.border}`,
            borderRadius: 20,
            padding: '32px 28px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            transition: 'transform 0.2s, border-color 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {tier.highlight && (
              <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, borderRadius: 20, padding: '4px 16px', fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                ✦ Most Popular
              </div>
            )}

            {/* Tier name + price */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tier.color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{tier.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 40, fontWeight: 900, color: C.text }}>${tier.price === 0 ? '0' : tier.price}</span>
                {tier.price > 0 && <span style={{ color: C.muted, fontSize: 14 }}>/month</span>}
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>{tier.description}</div>
            </div>

            {/* Features */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {tier.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: C.text, lineHeight: 1.4 }}>
                  <span style={{ color: tier.color, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => handleSubscribe(tier)}
              disabled={loading === tier.id}
              style={{
                background: tier.highlight
                  ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)`
                  : tier.id === 'free'
                    ? 'none'
                    : `${tier.color}22`,
                border: `1px solid ${tier.highlight ? 'transparent' : tier.color + '55'}`,
                borderRadius: 12,
                padding: '12px',
                color: tier.highlight ? '#fff' : tier.color,
                fontSize: 14,
                fontWeight: 700,
                cursor: loading === tier.id ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                width: '100%',
              }}
            >
              {loading === tier.id ? '...' : tier.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Commission comparison */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '40px 36px', marginBottom: 40 }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 8, textAlign: 'center' }}>How Creator Earnings Work</h2>
        <p style={{ color: C.muted, fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 1.7 }}>
          When a customer buys your product, Dreamscape deducts the Printful production cost, then splits the remaining profit with you based on your plan.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { tier: 'Free', commission: '30%', creator: '70%', color: C.muted, example: '$18.90' },
            { tier: 'Starter', commission: '25%', creator: '75%', color: C.teal, example: '$20.25' },
            { tier: 'Pro', commission: '20%', creator: '80%', color: C.accent, example: '$21.60' },
            { tier: 'Studio', commission: '15%', creator: '85%', color: C.gold, example: '$22.95' },
          ].map(row => (
            <div key={row.tier} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: row.color, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{row.tier}</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: C.text, fontFamily: 'Playfair Display, serif', marginBottom: 4 }}>{row.creator}</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>your share of profit</div>
              <div style={{ fontSize: 11, color: C.muted, background: C.bg, borderRadius: 8, padding: '6px 10px' }}>
                e.g. <span style={{ color: row.color, fontWeight: 700 }}>{row.example}</span> on a $45 sale*
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 20 }}>* Example assumes ~$18 Printful production cost on a $45 product. Actual earnings vary by product type and price.</p>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 24, textAlign: 'center' }}>Common Questions</h2>
        {[
          ['Can I cancel anytime?', 'Yes — cancel from your profile at any time. You keep access until the end of your billing period.'],
          ['When do I get paid?', 'Creator earnings are tracked per sale. Payouts are processed monthly to your connected bank account via Stripe.'],
          ['What is the Printful cost?', 'Printful charges a base cost per product for printing and fulfillment. This is deducted before the profit split. You can see the cost breakdown when creating a product.'],
          ['Can I upgrade or downgrade?', 'Yes — change plans anytime from your profile. Upgrades take effect immediately, downgrades apply at the next billing cycle.'],
          ['Do Free users earn money?', 'Free users can create art but need to upgrade to Starter or above to set up payouts and sell products.'],
        ].map(([q, a]) => (
          <div key={q} style={{ borderBottom: `1px solid ${C.border}`, padding: '18px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>{q}</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>{a}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
