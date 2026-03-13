import Stripe from 'stripe'

const PRICE_IDS = {
  starter: 'price_1TAYSiBG6LCYdFQRikmsiaPS',
  pro: 'price_1TAYSxBG6LCYdFQRWgaITKun',
  studio: 'price_1TAYTCBG6LCYdFQRZ3Yr0vKP',
}

export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers })

  try {
    const { tier, userId, email } = await req.json()
    if (!tier || !PRICE_IDS[tier]) {
      return new Response(JSON.stringify({ error: 'Invalid tier' }), { status: 400, headers })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: PRICE_IDS[tier], quantity: 1 }],
      success_url: `https://trydreamscape.com/profile?subscribed=true`,
      cancel_url: `https://trydreamscape.com/pricing`,
      metadata: { user_id: userId, tier },
      subscription_data: { metadata: { user_id: userId, tier } },
    })

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}

export const config = { path: '/api/create-subscription' }
