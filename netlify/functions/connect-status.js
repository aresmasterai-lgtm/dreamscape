import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers })

  try {
    const { userId } = await req.json()
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    )

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_id, stripe_connect_enabled')
      .eq('id', userId)
      .single()

    if (!profile?.stripe_connect_id) {
      return new Response(JSON.stringify({ connected: false, enabled: false }), { status: 200, headers })
    }

    // Check account status with Stripe
    const account = await stripe.accounts.retrieve(profile.stripe_connect_id)
    const enabled = account.charges_enabled && account.payouts_enabled

    // Update status in Supabase if it changed
    if (enabled !== profile.stripe_connect_enabled) {
      await supabase.from('profiles').update({ stripe_connect_enabled: enabled }).eq('id', userId)
    }

    return new Response(JSON.stringify({
      connected: true,
      enabled,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      requirements: account.requirements?.currently_due || [],
    }), { status: 200, headers })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}

export const config = { path: '/api/connect-status' }
