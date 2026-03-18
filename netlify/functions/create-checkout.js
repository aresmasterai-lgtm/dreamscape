import Stripe from 'stripe'
import { requireAuth, corsResponse, optionsResponse } from './auth-middleware.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST') return corsResponse({ error: 'Method not allowed' }, 405)

  try {
    // Verify auth — user must be logged in to subscribe
    const { user } = await requireAuth(req)

    const { priceId, tier, successUrl, cancelUrl } = await req.json()

    if (!priceId) return corsResponse({ error: 'Price ID required' }, 400)

    // Valid tiers
    const VALID_TIERS = ['starter', 'pro', 'studio', 'merchant', 'brand', 'enterprise']
    if (!VALID_TIERS.includes(tier)) return corsResponse({ error: 'Invalid tier' }, 400)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${req.headers.get('origin')}/profile?subscribed=true`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/pricing`,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        tier,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          tier,
        },
      },
      allow_promotion_codes: true,
    })

    return corsResponse({ url: session.url, sessionId: session.id })

  } catch (err) {
    if (err instanceof Response) return err
    console.error('create-checkout error:', err.message)
    return corsResponse({ error: err.message }, 500)
  }
}

export const config = { path: '/api/create-checkout' }
