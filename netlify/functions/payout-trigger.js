import Stripe from 'stripe'
import { requireAuth, corsResponse, optionsResponse } from './auth-middleware.js'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Minimum payout amount in cents
const MIN_PAYOUT_CENTS = 1000 // $10.00

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const { user } = await requireAuth(req)

    // Get creator's Stripe account
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_onboarded')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_account_id || !profile.stripe_onboarded) {
      return corsResponse({ error: 'Stripe account not connected or not fully onboarded' }, 400)
    }

    // Get all pending orders for this creator (orders older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: pendingOrders } = await supabase
      .from('orders')
      .select('id, creator_earnings')
      .eq('creator_id', user.id)
      .eq('payout_status', 'pending')
      .lt('created_at', sevenDaysAgo)

    if (!pendingOrders?.length) {
      return corsResponse({ message: 'No pending orders ready for payout', transferred: 0 })
    }

    const totalCents = Math.round(
      pendingOrders.reduce((s, o) => s + (o.creator_earnings || 0), 0) * 100
    )

    if (totalCents < MIN_PAYOUT_CENTS) {
      return corsResponse({
        message: `Minimum payout is $${MIN_PAYOUT_CENTS / 100}. Current pending: $${(totalCents / 100).toFixed(2)}`,
        transferred: 0,
      })
    }

    // Create Stripe transfer to creator's connected account
    const transfer = await stripe.transfers.create({
      amount:      totalCents,
      currency:    'usd',
      destination: profile.stripe_account_id,
      description: `Dreamscape creator payout — ${pendingOrders.length} orders`,
      metadata: {
        dreamscape_user_id: user.id,
        order_count:        pendingOrders.length,
        period_end:         new Date().toISOString(),
      },
    })

    // Mark orders as paid
    const orderIds = pendingOrders.map(o => o.id)
    await supabase
      .from('orders')
      .update({ payout_status: 'paid', paid_at: new Date().toISOString(), stripe_transfer_id: transfer.id })
      .in('id', orderIds)

    console.log(`Payout: $${(totalCents / 100).toFixed(2)} to ${profile.stripe_account_id} for ${pendingOrders.length} orders`)

    return corsResponse({
      success: true,
      transferred: totalCents / 100,
      orderCount: pendingOrders.length,
      transferId: transfer.id,
    })

  } catch (err) {
    if (err instanceof Response) return err
    console.error('payout-trigger error:', err.message)
    return corsResponse({ error: err.message }, 500)
  }
}

export const config = { path: '/api/payout-trigger' }
