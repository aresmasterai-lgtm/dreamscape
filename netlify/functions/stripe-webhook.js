import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const TIER_MAP = {
  'price_1TAYSiBG6LCYdFQRikmsiaPS': 'starter',
  'price_1TAYSxBG6LCYdFQRWgaITKun': 'pro',
  'price_1TAYTCBG6LCYdFQRZ3Yr0vKP': 'studio',
}

export default async (req) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  )

  // ── Subscription events ───────────────────────────────────────
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object
    const userId = sub.metadata?.user_id
    const priceId = sub.items?.data?.[0]?.price?.id
    const tier = TIER_MAP[priceId] || 'free'
    const status = sub.status // active, past_due, canceled, etc.

    if (userId) {
      await supabase.from('profiles').update({
        subscription_tier: status === 'active' ? tier : 'free',
        subscription_status: status,
        stripe_customer_id: sub.customer,
      }).eq('id', userId)
      console.log(`✅ Subscription ${event.type}: user ${userId} → ${tier} (${status})`)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    const userId = sub.metadata?.user_id
    if (userId) {
      await supabase.from('profiles').update({
        subscription_tier: 'free',
        subscription_status: 'canceled',
      }).eq('id', userId)
      console.log(`✅ Subscription canceled: user ${userId} → free`)
    }
  }

  // ── One-time checkout (product purchases) ────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    // Handle subscription checkout — update customer ID
    if (session.mode === 'subscription') {
      const userId = session.metadata?.user_id
      if (userId) {
        await supabase.from('profiles').update({
          stripe_customer_id: session.customer,
        }).eq('id', userId)
      }
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    // Handle product purchase
    if (session.payment_status !== 'paid') {
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    const { printful_product_id, product_name, variant_name, quantity } = session.metadata

    const shipping = session.shipping_details?.address
      ? session.shipping_details
      : session.customer_details
        ? { name: session.customer_details.name, address: session.customer_details.address }
        : null

    if (!printful_product_id || !shipping?.address) {
      console.log('No Printful product ID or shipping — skipping order creation')
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    const pfHeaders = {
      'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json',
      'X-PF-Store-Id': process.env.PRINTFUL_STORE_ID || '',
    }

    let printfulOrderId = null
    let mockupUrl = ''

    try {
      console.log(`Fetching Printful store product: ${printful_product_id}`)
      const productRes = await fetch(`https://api.printful.com/store/products/${printful_product_id}`, { headers: pfHeaders })
      const productData = await productRes.json()

      if (!productRes.ok) {
        console.error('Failed to fetch Printful product:', JSON.stringify(productData))
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      const syncVariants = productData.result?.sync_variants || []
      if (!syncVariants.length) {
        console.error('No sync variants found')
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      const syncVariantId = syncVariants[0].id
      mockupUrl = productData.result?.sync_product?.thumbnail_url || ''
      console.log(`Using sync variant ID: ${syncVariantId} (${syncVariants[0].name})`)

      const printfulOrder = {
        recipient: {
          name: shipping.name,
          address1: shipping.address.line1,
          address2: shipping.address.line2 || '',
          city: shipping.address.city,
          state_code: shipping.address.state,
          country_code: shipping.address.country,
          zip: shipping.address.postal_code,
        },
        items: [{ sync_variant_id: syncVariantId, quantity: parseInt(quantity || 1) }],
      }

      const pfRes = await fetch('https://api.printful.com/orders', {
        method: 'POST', headers: pfHeaders, body: JSON.stringify(printfulOrder),
      })
      const pfData = await pfRes.json()

      if (pfRes.ok) {
        printfulOrderId = String(pfData.result?.id || '')
        console.log(`✅ Printful order created: ${printfulOrderId} for ${product_name}`)
        const confirmRes = await fetch(`https://api.printful.com/orders/${pfData.result.id}/confirm`, {
          method: 'POST', headers: pfHeaders,
        })
        if (confirmRes.ok) console.log(`✅ Printful order confirmed`)
        else console.error('Printful confirm failed:', await confirmRes.json())
      } else {
        console.error('Printful order failed:', JSON.stringify(pfData))
      }
    } catch (err) {
      console.error('Error creating Printful order:', err.message)
    }

    // Save order + calculate creator earnings
    try {
      const amountTotal = session.amount_total / 100

      // Look up product to find creator and their tier for commission rate
      const { data: product } = await supabase
        .from('products')
        .select('user_id, printful_cost')
        .eq('printful_product_id', printful_product_id)
        .single()

      let creatorEarnings = null
      let dreamscapeEarnings = null

      if (product?.user_id) {
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', product.user_id)
          .single()

        const tier = creatorProfile?.subscription_tier || 'free'
        const commissionRates = { free: 0.30, starter: 0.25, pro: 0.20, studio: 0.15 }
        const printfulCost = product.printful_cost || 0
        const grossProfit = amountTotal - printfulCost
        const dreamscapeRate = commissionRates[tier] || 0.30
        dreamscapeEarnings = parseFloat((grossProfit * dreamscapeRate).toFixed(2))
        creatorEarnings = parseFloat((grossProfit * (1 - dreamscapeRate)).toFixed(2))
        console.log(`💰 Creator earnings: $${creatorEarnings} | Dreamscape: $${dreamscapeEarnings} (${tier} tier, ${dreamscapeRate * 100}% commission)`)
      }

      await supabase.from('orders').insert({
        user_id: null,
        stripe_session_id: session.id,
        printful_order_id: printfulOrderId,
        product_name: product_name || '',
        variant_name: variant_name || '',
        quantity: parseInt(quantity || 1),
        amount_total: amountTotal,
        status: printfulOrderId ? 'confirmed' : 'pending',
        mockup_url: mockupUrl,
        shipping_name: shipping.name || '',
        shipping_address: shipping.address || {},
        creator_id: product?.user_id || null,
        creator_earnings: creatorEarnings,
        dreamscape_earnings: dreamscapeEarnings,
      })
      console.log(`✅ Order saved to Supabase`)
    } catch (err) {
      console.error('Error saving order:', err.message)
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
}

export const config = { path: '/api/stripe-webhook' }
