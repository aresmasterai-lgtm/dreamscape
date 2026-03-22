import Stripe from 'stripe'
import { requireAuth, corsResponse, optionsResponse } from './auth-middleware.js'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const { user } = await requireAuth(req)

    // Check if creator already has a Stripe account
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_onboarded')
      .eq('id', user.id)
      .single()

    let accountId = profile?.stripe_account_id

    // Create a new Express account if none exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        capabilities: { transfers: { requested: true } },
        business_type: 'individual',
        metadata: { dreamscape_user_id: user.id },
      })
      accountId = account.id

      // Save to profile immediately
      await supabase
        .from('profiles')
        .update({ stripe_account_id: accountId, stripe_onboarded: false })
        .eq('id', user.id)
    }

    // Create onboarding link
    const origin = req.headers.get('origin') || 'https://trydreamscape.com'
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/profile?connect=refresh`,
      return_url:  `${origin}/profile?connect=success`,
      type: 'account_onboarding',
    })

    return corsResponse({ url: accountLink.url })

  } catch (err) {
    if (err instanceof Response) return err
    console.error('connect-onboard error:', err.message)
    return corsResponse({ error: err.message }, 500)
  }
}

export const config = { path: '/api/connect-onboard' }
