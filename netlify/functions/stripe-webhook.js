import { createClient } from '@supabase/supabase-js'
import { sendEmail, templates } from './send-email.js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Earnings calculation ──────────────────────────────────────
const DS_FEE    = 0.10   // 10% Dreamscape platform fee
const ST_PCT    = 0.029  // Stripe 2.9%
const ST_FIXED  = 0.30   // Stripe $0.30

function calcSplit(amountTotal, baseCost, artistRoyaltyPct = 0) {
  const retail         = amountTotal / 100  // Stripe sends cents
  const stripeFee      = retail * ST_PCT + ST_FIXED
  const dreamscapeFee  = retail * DS_FEE
  const afterFees      = retail - (baseCost || 0) - stripeFee - dreamscapeFee

  // Artist royalty is a % of the after-fees profit
  const artistRoyalty  = artistRoyaltyPct > 0
    ? parseFloat((afterFees * (artistRoyaltyPct / 100)).toFixed(2))
    : 0

  const creatorEarnings = parseFloat((afterFees - artistRoyalty).toFixed(2))

  return {
    retail,
    stripeFee: parseFloat(stripeFee.toFixed(2)),
    dreamscapeFee: parseFloat(dreamscapeFee.toFixed(2)),
    artistRoyalty,
    creatorEarnings,
    dreamscapeNet: parseFloat(dreamscapeFee.toFixed(2)),
  }
}

export default async (req) => {
  const sig     = req.headers.get('stripe-signature')
  const rawBody = await req.text()

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature failed:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // ── checkout.session.completed ─────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    try {
      const metadata = session.metadata || {}
      const amountTotal     = session.amount_total || 0
      const productId       = metadata.productId
      const creatorId       = metadata.creatorId
      const printfulVariantId = metadata.printfulVariantId

      // ── IDEMPOTENCY: skip duplicate webhook deliveries ────
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('stripe_session_id', session.id)
        .maybeSingle()
      if (existing) {
        console.log(`Order for session ${session.id} already exists — skipping duplicate webhook`)
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        })
      }

      // Load product to get original artist attribution + base cost
      let product = null
      let baseCost = 0
      let originalArtistId = null
      let artistRoyaltyPct = 0

      if (productId) {
        const { data } = await supabase
          .from('products')
          .select('user_id, price, original_artist_id, artist_royalty_pct')
          .eq('id', productId)
          .single()

        if (data) {
          product = data
          originalArtistId = data.original_artist_id
          artistRoyaltyPct = data.artist_royalty_pct || 0
          baseCost = (data.price || 0) * 0.40
        }
      }

      // Calculate the earnings split
      const split = calcSplit(amountTotal, baseCost, artistRoyaltyPct)

      // Insert order record
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          user_id:              null,
          creator_id:           creatorId || product?.user_id || null,
          original_artist_id:   originalArtistId,
          stripe_session_id:    session.id,
          amount_total:         split.retail,
          creator_earnings:     split.creatorEarnings,
          dreamscape_earnings:  split.dreamscapeFee,
          artist_royalty:       split.artistRoyalty,
          payout_status:        'pending',
          artist_payout_status: split.artistRoyalty > 0 ? 'pending' : 'n/a',
          status:               'confirmed',
          product_name:         metadata.productName || 'Product',
          mockup_url:           metadata.mockupUrl || null,
          shipping_name:        session.shipping_details?.name || null,
        })
        .select('id')
        .single()

      if (orderErr) throw orderErr

      console.log(`Order ${order.id} created:`, {
        retail: split.retail,
        creatorEarnings: split.creatorEarnings,
        artistRoyalty: split.artistRoyalty,
        dreamscapeFee: split.dreamscapeFee,
        artistId: originalArtistId,
      })

      // Send sale notification email to creator
      if (creatorId || product?.user_id) {
        try {
          const { data: creatorProfile } = await supabase
            .from('profiles')
            .select('email_notifications')
            .eq('id', creatorId || product?.user_id)
            .single()

          const { data: { user: creatorUser } } = await supabase.auth.admin.getUserById(creatorId || product?.user_id)
          
          if (creatorUser?.email && creatorProfile?.email_notifications !== false) {
            const emailData = templates.sale({
              productName: metadata.productName || 'Your product',
              earnings: split.creatorEarnings,
              buyerLocation: session.shipping_details?.address?.city
                ? `${session.shipping_details.address.city}, ${session.shipping_details.address.country}`
                : null,
              orderId: order.id,
            })
            await sendEmail({ to: creatorUser.email, ...emailData })
          }
        } catch (emailErr) {
          console.warn('Sale email failed (non-fatal):', emailErr.message)
        }
      }

    } catch (err) {
      console.error('Webhook processing error:', err.message)
      // Return 200 anyway — Stripe will retry on non-200, leading to duplicate orders
    }
  }

  // ── customer.subscription.deleted ─────────────────────────
  // Fires when a subscription is cancelled or payment fails permanently
  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.paused') {
    const subscription = event.data.object
    try {
      const customerId = subscription.customer
      // Find user by Stripe customer ID stored in profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, subscription_tier')
        .eq('stripe_customer_id', customerId)
        .maybeSingle()

      if (profile && profile.subscription_tier !== 'free') {
        await supabase
          .from('profiles')
          .update({ subscription_tier: 'free', stripe_subscription_id: null })
          .eq('id', profile.id)
        console.log(`Downgraded user ${profile.id} from ${profile.subscription_tier} to free (subscription deleted)`)
      }
    } catch (err) {
      console.error('Subscription deletion handler error:', err.message)
    }
  }

  // ── invoice.payment_failed ─────────────────────────────────
  // Fires on failed renewal — give a grace period (Stripe retries 3x over ~1 week)
  // On the 3rd failure Stripe fires subscription.deleted — handled above
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object
    const attempt = invoice.attempt_count || 1
    console.log(`Payment failed for customer ${invoice.customer} — attempt ${attempt}/3`)
    // Only act on final failure (Stripe fires subscription.deleted too, but log here)
    if (attempt >= 3) {
      console.warn(`Final payment failure for ${invoice.customer} — subscription.deleted should follow`)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config = { path: '/api/stripe-webhook' }
