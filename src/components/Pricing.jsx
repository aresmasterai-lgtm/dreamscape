import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const C = {
  bg: '#030508', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
  merchant: '#FF6B4A', brand: '#FF4F9A', enterprise: '#F5C842',
}

const CREATOR_PLANS = [
  {
    id: 'free', name: 'Free', price: 0, betaPrice: 0,
    color: C.muted, description: 'Get started exploring AI art',
    features: ['10 AI generations / month', '3 products listed', 'Public gallery access', 'Basic Dream AI chat', '30% platform commission'],
    cta: 'Start Free', stripeLink: null,
  },
  {
    id: 'starter', name: 'Starter', price: 9.99, betaPrice: 4.99,
    color: C.teal, description: 'For emerging creators',
    features: ['50 AI generations / month', '15 products listed', 'Sell in the marketplace', '25% platform commission', 'Stripe payouts', 'Basic analytics'],
    cta: 'Get Starter', stripeLink: null,
  },
  {
    id: 'pro', name: 'Pro', price: 19.99, betaPrice: 9.99,
    color: C.accent, description: 'For serious artists', popular: true,
    features: ['200 AI generations / month', '50 products listed', '20% platform commission', 'Artwork licensing + royalties', 'Priority support', 'Advanced analytics'],
    cta: 'Go Pro', stripeLink: null,
  },
  {
    id: 'studio', name: 'Studio', price: 49.99, betaPrice: 24.99,
    color: C.gold, description: 'For power creators',
    features: ['Unlimited AI generations', 'Unlimited products', '15% platform commission', 'Artwork licensing + royalties', 'Priority mockup generation', 'Full analytics suite', 'Early feature access'],
    cta: 'Go Studio', stripeLink: null,
  },
]

const BUSINESS_PLANS = [
  {
    id: 'merchant', name: 'Merchant', price: 79.99, betaPrice: 39.99,
    color: C.merchant, description: 'For small businesses & shops',
    features: ['100 AI generations / month', 'Unlimited products', '8% platform commission', 'Brand storefront', 'Bulk product creation', '3 team seats', 'CSV order export', 'Basic analytics dashboard'],
    cta: 'Start Merchant', stripeLink: null,
  },
  {
    id: 'brand', name: 'Brand', price: 149.99, betaPrice: 74.99,
    color: C.brand, description: 'For growing brands', popular: true,
    features: ['500 AI generations / month', 'Unlimited products', '6% platform commission', 'Brand storefront + custom domain', 'Bulk product creation', '10 team seats', 'CSV order & customer export', 'Advanced analytics', 'Priority support'],
    cta: 'Start Brand', stripeLink: null,
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 299.99, betaPrice: 149.99,
    color: C.enterprise, description: 'For large operations',
    features: ['Unlimited AI generations', 'Unlimited products', '4% platform commission', 'White-label storefront', 'Bulk product creation', 'Unlimited team seats', 'Full data export + API access', 'Full analytics suite', 'Dedicated support channel', 'SLA guarantee'],
    cta: 'Go Enterprise', stripeLink: null,
  },
]

function PlanCard({ plan, annual, onCta, isBusiness = false }) {
  const monthly = plan.betaPrice === 0 ? 0 : (annual ? plan.betaPrice * 0.8 : plan.betaPrice)
  const original = annual ? plan.price * 0.8 : plan.price

  return (
    <div style={{
      background: C.card,
      border: `2px solid ${plan.popular ? plan.color : C.border}`,
      borderRadius: 20, padding: '28px 22px',
      position: 'relative', display: 'flex', flexDirection: 'column',
      boxShadow: plan.popular ? `0 0 40px ${plan.color}18, 0 0 0 1px ${plan.color}22` : 'none',
    }}>
      {plan.popular && (
        <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(135deg, ${plan.color}, ${plan.color}99)`, borderRadius: 10, padding: '3px 16px', fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
          {isBusiness ? '⭐ Most Popular' : '✦ Most Popular'}
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: plan.color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>{plan.name}</div>
        <div style={{ fontSize: 12, color: C.muted }}>{plan.description}</div>
      </div>

      <div style={{ marginBottom: 22 }}>
        {plan.price === 0 ? (
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 36, fontWeight: 900, color: C.text }}>Free</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 34, fontWeight: 900, color: plan.color }}>${monthly.toFixed(2)}</span>
              <span style={{ fontSize: 13, color: C.muted }}>/mo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: C.muted, textDecoration: 'line-through' }}>${original.toFixed(2)}/mo</span>
              <span style={{ fontSize: 10, background: `${C.gold}22`, border: `1px solid ${C.gold}44`, borderRadius: 6, padding: '1px 6px', color: C.gold, fontWeight: 700 }}>50% OFF</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Beta price — locks in at launch</div>
          </>
        )}
      </div>

      <button onClick={() => onCta(plan)}
        style={{ background: plan.id === 'free' ? 'none' : `linear-gradient(135deg, ${plan.color}cc, ${plan.color}88)`, border: `2px solid ${plan.color}${plan.id === 'free' ? '55' : '00'}`, borderRadius: 12, padding: '11px', color: plan.id === 'free' ? plan.color : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%', marginBottom: 22 }}>
        {plan.cta}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {plan.features.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: plan.color, fontSize: 12, flexShrink: 0, marginTop: 1 }}>✓</span>
            <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Pricing({ user, onSignIn }) {
  const navigate = useNavigate()
  const [annual, setAnnual] = useState(false)
  const [tab, setTab] = useState('creator')

  const handleCta = (plan) => {
    if (plan.id === 'free') { user ? navigate('/create') : onSignIn(); return }
    if (plan.stripeLink) { window.location.href = plan.stripeLink; return }
    user ? navigate('/profile') : onSignIn()
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 20px 80px' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${C.gold}18`, border: `1px solid ${C.gold}44`, borderRadius: 20, padding: '6px 18px', marginBottom: 20 }}>
          <span>🎉</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.gold }}>BETA — All plans 50% off forever as a founding member</span>
        </div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, color: C.text, marginBottom: 12 }}>
          Simple, honest pricing
        </h1>
        <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.7, maxWidth: 520, margin: '0 auto 28px' }}>
          Lock in founding member pricing now — your rate stays even after we raise prices at launch.
        </p>

        {/* Creator / Business tab switcher */}
        <div style={{ display: 'inline-flex', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 4, marginBottom: 24, gap: 4 }}>
          {[['creator', '🎨 For Creators'], ['business', '🏢 For Businesses']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ background: tab === id ? (id === 'business' ? `linear-gradient(135deg, ${C.merchant}, ${C.brand})` : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`) : 'none', border: 'none', borderRadius: 10, padding: '9px 22px', color: tab === id ? '#fff' : C.muted, fontSize: 13, fontWeight: tab === id ? 700 : 400, cursor: 'pointer', transition: 'all 0.2s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Annual toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: annual ? C.muted : C.text, fontWeight: annual ? 400 : 600 }}>Monthly</span>
          <button onClick={() => setAnnual(a => !a)}
            style={{ width: 40, height: 22, borderRadius: 11, background: annual ? C.accent : C.border, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
            <span style={{ position: 'absolute', top: 3, left: annual ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
          </button>
          <span style={{ fontSize: 13, color: annual ? C.text : C.muted, fontWeight: annual ? 600 : 400 }}>
            Annual <span style={{ color: C.teal, fontSize: 11 }}>Save 20%</span>
          </span>
        </div>
      </div>

      {/* Creator plans */}
      {tab === 'creator' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, alignItems: 'start' }}>
          {CREATOR_PLANS.map(plan => (
            <PlanCard key={plan.id} plan={plan} annual={annual} onCta={handleCta} />
          ))}
        </div>
      )}

      {/* Business plans */}
      {tab === 'business' && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 28, padding: '20px 24px', background: `linear-gradient(135deg, ${C.merchant}0C, ${C.brand}0C)`, border: `1px solid ${C.merchant}33`, borderRadius: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.merchant, marginBottom: 6 }}>Built for merchandisers, brands, and growing businesses</div>
            <p style={{ fontSize: 13, color: C.muted, maxWidth: 560, margin: '0 auto' }}>
              Every business tier includes unlimited products, brand storefront, bulk creation tools, and team seats. The higher your volume, the lower your commission.
            </p>
          </div>

          {/* Commission comparison */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
            {[['Merchant', '8%', C.merchant], ['Brand', '6%', C.brand], ['Enterprise', '4%', C.enterprise]].map(([name, pct, color]) => (
              <div key={name} style={{ background: C.card, border: `1px solid ${color}44`, borderRadius: 12, padding: '10px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: 'Playfair Display, serif' }}>{pct}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{name} commission</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
            {BUSINESS_PLANS.map(plan => (
              <PlanCard key={plan.id} plan={plan} annual={annual} onCta={handleCta} isBusiness />
            ))}
          </div>
        </>
      )}

      {/* Founding member guarantee */}
      <div style={{ textAlign: 'center', marginTop: 52, padding: '28px 32px', background: `${C.gold}0C`, border: `1px solid ${C.gold}33`, borderRadius: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.gold, marginBottom: 8 }}>🎉 Founding Member Guarantee</div>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, maxWidth: 560, margin: '0 auto' }}>
          Join during Beta and your 50% discount is <strong style={{ color: C.text }}>locked in forever</strong> — even when we raise prices at launch. As a founding member you get priority access to every new feature, and your feedback directly shapes the platform.
        </p>
      </div>

      {/* FAQ */}
      <div style={{ marginTop: 56 }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, textAlign: 'center', marginBottom: 32 }}>Common questions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {[
            ['When does Beta pricing end?', "Beta pricing locks in when we launch Dreamscape v1.0. We haven't set a date — join now and your rate is guaranteed regardless."],
            ['Can I switch between Creator and Business tiers?', 'Yes — upgrade, downgrade, or switch between creator and business plans any time. Your founding member discount stays.'],
            ['What is platform commission?', 'When you sell a product, Dreamscape takes a small cut. Business tiers pay significantly less — Enterprise pays just 4%.'],
            ['How do artist royalties work?', 'When you license your artwork, other creators can build products from it and you earn a % of every sale automatically via Stripe.'],
            ['What counts as an AI generation?', 'Each image generated by Dream AI counts as one. Generations reset on the 1st of every month.'],
            ['Is there a free trial?', 'The Free plan is your trial — no credit card, no time limit. Upgrade whenever ready.'],
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
