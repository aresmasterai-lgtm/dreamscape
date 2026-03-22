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

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_onboarded')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_account_id) {
      return corsResponse({ connected: false, enabled: false })
    }

    // Verify with Stripe
    const account = await stripe.accounts.retrieve(profile.stripe_account_id)
    const connected = !!account.id
    const enabled   = account.charges_enabled && account.payouts_enabled

    // Update onboarded flag if newly completed
    if (enabled && !profile.stripe_onboarded) {
      await supabase
        .from('profiles')
        .update({ stripe_onboarded: true })
        .eq('id', user.id)
    }

    return corsResponse({
      connected,
      enabled,
      accountId:       profile.stripe_account_id,
      chargesEnabled:  account.charges_enabled,
      payoutsEnabled:  account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      country:         account.country,
    })

  } catch (err) {
    if (err instanceof Response) return err
    console.error('connect-status error:', err.message)
    return corsResponse({ connected: false, enabled: false, error: err.message })
  }
}

export const config = { path: '/api/connect-status' }
