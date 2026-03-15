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
    const { userId, email } = await req.json()
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    )

    // Check if creator already has a connect account
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_id, stripe_connect_enabled')
      .eq('id', userId)
      .single()

    let accountId = profile?.stripe_connect_id

    // Create a new Standard connect account if they don't have one
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        email,
        metadata: { user_id: userId },
      })
      accountId = account.id

      // Save the account ID to their profile
      await supabase.from('profiles').update({
        stripe_connect_id: accountId,
        stripe_connect_enabled: false,
      }).eq('id', userId)
    }

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: 'https://trydreamscape.com/profile?connect=refresh',
      return_url: 'https://trydreamscape.com/profile?connect=success',
      type: 'account_onboarding',
    })

    return new Response(JSON.stringify({ url: accountLink.url }), { status: 200, headers })
  } catch (err) {
    console.error('Connect onboard error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}

export const config = { path: '/api/connect-onboard' }
