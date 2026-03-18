import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const C = {
  bg: '#030508', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
  red: '#FF4D4D', business: '#FF6B4A',
}

// ── Beta pricing (50% off) ─────────────────────────────────────
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    betaPrice: 0,
    color: C.muted,
    border: C.border,
    description: 'Get started exploring AI art',
    features: [
      '10 AI generations / month',
      '3 products listed',
      'Public gallery access',
      'Basic Dream AI chat',
    ],
    cta: 'Start Free',
    stripeLink: null,
    tier: 'free',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 9.99,
    betaPrice: 4.99,
    color: C.teal,
    border: C.teal,
    description: 'For emerging creators',
    features: [
      '50 AI generations / month',
      '15 products listed',
      'Sell in the marketplace',
      '25% platform commission',
      'Stripe payouts',
      'Analytics basics',
    ],
    cta: 'Start for $4.99/mo',
    stripeLink: null,
    tier: 'starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19.99,
    betaPrice: 9.99,
    color: C.accent,
    border: C.accent,
    popular: true,
    description: 'For serious artists',
    features: [
      '200 AI generations / month',
      '50 products listed',
      '20% platform commission',
      'Artwork licensing + royalties',
      'Priority support',
      'Advanced analytics',
    ],
    cta: 'Start for $9.99/mo',
    stripeLink: null,
    tier: 'pro',
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 49.99,
    betaPrice: 24.99,
    color: C.gold,
    border: C.gold,
    description: 'For power creators',
    features: [
      'Unlimited AI generations',
      'Unlimited products',
      '15% platform commission',
      'Artwork licensing + royalties',
      'Priority mockup generation',
      'Full analytics suite',
      'Early feature access',
    ],
    cta: 'Start for $24.99/mo',
    stripeLink: null,
    tier: 'studio',
  },
  {
    id: 'business',
    name: 'Business',
    price: 79.99,
    betaPrice: 39.99,
    color: C.business,
    border: C.business,
    description: 'For brands & merchandisers',
    isNew: true,
    features: [
      '100 AI generations / month',
      'Unlimited products',
      '8% platform commission',
      'Brand storefront',
      'Bulk product creation',
      'Team seats (up to 3)',
      'CSV order & revenue export',
      'Priority analytics dashboard',
      'Dedicated support channel',
    ],
    cta: 'Start for $39.99/mo',
    stripeLink: null,
    tier: 'business',
  },
]

const BETA_END = 'when v1.0 launches'

export default function Pricing({ user, onSignIn }) {
  const navigate = useNavigate()
  const [annual, setAnnual] = useState(false)

  const handleCta = (plan) => {
    if (plan.id === 'free') {
      if (user) navigate('/create')
      else onSignIn()
      return
    }
    if (plan.stripeLink) {
      window.location.href = plan.stripeLink
    } else {
      // Stripe not yet configured — prompt sign up
      if (!user) { onSignIn(); return }
      navigate('/profile')
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 20px 80px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${C.gold}18`, border: `1px solid ${C.gold}44`, borderRadius: 20, padding: '6px 16px', marginBottom: 20 }}>
          <span style={{ fontSize: 14 }}>🎉</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.gold }}>BETA — All plans 50% off forever as a founding member</span>
        </div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, color: C.text, marginBottom: 12 }}>
          Simple, honest pricing
        </h1>
        <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.7, maxWidth: 500, margin: '0 auto 24px' }}>
          Lock in founding member pricing now. These rates stay with you even after we raise prices at launch.
        </p>
        {/* Annual toggle */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '6px 16px' }}>
          <span style={{ fontSize: 13, color: annual ? C.muted : C.text, fontWeight: annual ? 400 : 600 }}>Monthly</span>
          <button onClick={() => setAnnual(a => !a)}
            style={{ width: 40, height: 22, borderRadius: 11, background: annual ? C.accent : C.border, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
            <span style={{ position: 'absolute', top: 3, left: annual ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </button>
          <span style={{ fontSize: 13, color: annual ? C.text : C.muted, fontWeight: annual ? 600 : 400 }}>Annual <span style={{ color: C.teal, fontSize: 11 }}>Save 20%</span></span>
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'start' }}>
        {PLANS.map(plan => {
          const monthlyPrice = plan.betaPrice === 0 ? 0 : (annual ? plan.betaPrice * 0.8 : plan.betaPrice)
          const originalPrice = plan.price

          return (
            <div key={plan.id}
              style={{ background: C.card, border: `2px solid ${plan.popular || plan.isNew ? plan.border : C.border}`, borderRadius: 20, padding: '28px 22px', position: 'relative', display: 'flex', flexDirection: 'column', gap: 0,
                boxShadow: plan.popular || plan.isNew ? `0 0 0 1px ${plan.border}22, 0 0 40px ${plan.border}18` : 'none',
              }}>

              {/* Badge */}
              {plan.popular && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, borderRadius: 10, padding: '3px 14px', fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                  Most Popular
                </div>
              )}
              {plan.isNew && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(135deg, ${C.business}, #cc4422)`, borderRadius: 10, padding: '3px 14px', fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                  🏢 Business
                </div>
              )}

              {/* Plan name + desc */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: plan.color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{plan.name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{plan.description}</div>
              </div>

              {/* Pricing */}
              <div style={{ marginBottom: 24 }}>
                {plan.price === 0 ? (
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 36, fontWeight: 900, color: C.text }}>Free</div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 36, fontWeight: 900, color: plan.color }}>${monthlyPrice.toFixed(2)}</span>
                      <span style={{ fontSize: 13, color: C.muted }}>/mo</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: C.muted, textDecoration: 'line-through' }}>${(annual ? originalPrice * 0.8 : originalPrice).toFixed(2)}/mo</span>
                      <span style={{ fontSize: 11, background: `${C.gold}22`, border: `1px solid ${C.gold}44`, borderRadius: 6, padding: '1px 6px', color: C.gold, fontWeight: 700 }}>50% OFF</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                      Beta price — locks in {BETA_END}
                    </div>
                  </div>
                )}
              </div>

              {/* CTA */}
              <button onClick={() => handleCta(plan)}
                style={{
                  background: plan.id === 'free' ? 'none' : `linear-gradient(135deg, ${plan.color}cc, ${plan.color}88)`,
                  border: `2px solid ${plan.color}${plan.id === 'free' ? '55' : ''}`,
                  borderRadius: 12, padding: '11px', color: plan.id === 'free' ? plan.color : '#fff',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%', marginBottom: 24,
                  transition: 'all 0.15s',
                }}>
                {plan.cta}
              </button>

              {/* Features */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: plan.color, fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Beta note */}
      <div style={{ textAlign: 'center', marginTop: 48, padding: '24px 32px', background: `${C.gold}0C`, border: `1px solid ${C.gold}33`, borderRadius: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.gold, marginBottom: 8 }}>🎉 Founding Member Guarantee</div>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, maxWidth: 560, margin: '0 auto' }}>
          Join during Beta and your 50% discount is <strong style={{ color: C.text }}>locked in forever</strong> — even when we raise prices at launch. As a founding member, you also get priority access to every new feature, and your feedback directly shapes the platform.
        </p>
      </div>

      {/* FAQ */}
      <div style={{ marginTop: 56 }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, textAlign: 'center', marginBottom: 32 }}>Common questions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {[
            ['When does Beta pricing end?', 'Beta pricing locks in when we launch Dreamscape v1.0. We haven\'t set a date yet — join now and your rate is guaranteed regardless.'],
            ['Can I change plans?', 'Yes — upgrade or downgrade any time. Your founding member discount stays on whichever plan you\'re on.'],
            ['What is the platform commission?', 'When you sell a product, Dreamscape takes a small cut to cover infrastructure. Lower tiers pay more; Business pays just 8%.'],
            ['How do artist royalties work?', 'When you publish artwork with a royalty license, other creators can build products from it and you earn a % of every sale — automatically.'],
            ['What counts as an AI generation?', 'Each image generated by Dream AI counts as one generation. Generations reset on the 1st of every month.'],
            ['Is there a free trial?', 'The Free plan is your trial — no credit card, no time limit. Upgrade whenever you\'re ready.'],
          ].map(([q, a]) => (
            <div key={q} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>{q}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
