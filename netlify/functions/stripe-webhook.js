import Stripe from 'stripe'

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
    const shipping = session.shipping_details

    if (!printful_product_id || !shipping?.address) {
      console.log('No Printful product ID or shipping — skipping order creation')
      console.log('metadata:', JSON.stringify(session.metadata))
      console.log('shipping:', JSON.stringify(shipping))
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    const pfHeaders = {
      'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json',
      'X-PF-Store-Id': process.env.PRINTFUL_STORE_ID || '',
    }

    try {
      // Step 1: Fetch the store product to get sync variant IDs
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

      // Use the first sync variant (buyer picked product, not size — size selection coming later)
      const syncVariantId = syncVariants[0].id
      console.log(`Using sync variant ID: ${syncVariantId} (${syncVariants[0].name})`)

      // Step 2: Create the Printful order
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
        items: [
          {
            sync_variant_id: syncVariantId,
            quantity: parseInt(quantity || 1),
          },
        ],
        retail_costs: {
          subtotal: (session.amount_total / 100).toFixed(2),
          shipping: '0.00',
          tax: '0.00',
          total: (session.amount_total / 100).toFixed(2),
        },
      }

      const pfRes = await fetch('https://api.printful.com/orders', {
        method: 'POST',
        headers: pfHeaders,
        body: JSON.stringify(printfulOrder),
      })
      const pfData = await pfRes.json()

      if (pfRes.ok) {
        console.log(`✅ Printful order created: ${pfData.result?.id} for ${product_name}`)

        // Confirm order — moves from draft to production
        const confirmRes = await fetch(`https://api.printful.com/orders/${pfData.result.id}/confirm`, {
          method: 'POST',
          headers: pfHeaders,
        })
        const confirmData = await confirmRes.json()

        if (confirmRes.ok) {
          console.log(`✅ Printful order confirmed and submitted to production`)
        } else {
          console.error('Printful confirm failed:', JSON.stringify(confirmData))
        }
      } else {
        console.error('Printful order creation failed:', JSON.stringify(pfData))
      }
    } catch (err) {
      console.error('Error creating Printful order:', err.message)
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
}

export const config = { path: '/api/stripe-webhook' }
