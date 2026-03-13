import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

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
      console.log('shipping_details:', JSON.stringify(session.shipping_details))
      console.log('customer_details:', JSON.stringify(session.customer_details))
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
      // Fetch store product to get sync variant IDs + mockup
      console.log(`Fetching Printful store product: ${printful_product_id}`)
      const productRes = await fetch(`https://api.printful.com/store/products/${printful_product_id}`, {
        headers: pfHeaders,
      })
      const productData = await productRes.json()

      if (!productRes.ok) {
        console.error('Failed to fetch Printful product:', JSON.stringify(productData))
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      const syncVariants = productData.result?.sync_variants || []
      if (syncVariants.length === 0) {
        console.error('No sync variants found for product:', printful_product_id)
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      const syncVariantId = syncVariants[0].id
      mockupUrl = productData.result?.sync_product?.thumbnail_url || ''
      console.log(`Using sync variant ID: ${syncVariantId} (${syncVariants[0].name})`)

      // Create Printful order
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
        retail_costs: {
          subtotal: (session.amount_total / 100).toFixed(2),
          shipping: '0.00',
          tax: '0.00',
          total: (session.amount_total / 100).toFixed(2),
        },
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
        if (confirmRes.ok) {
          console.log(`✅ Printful order confirmed and submitted to production`)
        } else {
          const confirmData = await confirmRes.json()
          console.error('Printful confirm failed:', JSON.stringify(confirmData))
        }
      } else {
        console.error('Printful order creation failed:', JSON.stringify(pfData))
      }
    } catch (err) {
      console.error('Error creating Printful order:', err.message)
    }

    // Save order to Supabase regardless of Printful outcome
    try {
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
      )

      await supabase.from('orders').insert({
        user_id: null, // claimed by user on success page via session_id
        stripe_session_id: session.id,
        printful_order_id: printfulOrderId,
        product_name: product_name || '',
        variant_name: variant_name || '',
        quantity: parseInt(quantity || 1),
        amount_total: session.amount_total / 100,
        status: printfulOrderId ? 'confirmed' : 'pending',
        mockup_url: mockupUrl,
        shipping_name: shipping.name || '',
        shipping_address: shipping.address || {},
      })
      console.log(`✅ Order saved to Supabase (session: ${session.id})`)
    } catch (err) {
      console.error('Error saving order to Supabase:', err.message)
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
}

export const config = { path: '/api/stripe-webhook' }
