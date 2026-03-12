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

    // Only process paid sessions
    if (session.payment_status !== 'paid') {
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    const { printful_variant_id, product_name, variant_name, quantity } = session.metadata
    const shipping = session.shipping_details

    if (!printful_variant_id || !shipping?.address) {
      console.log('No Printful variant or shipping — skipping order creation')
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    // Build Printful order
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
          sync_variant_id: parseInt(printful_variant_id),
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

    try {
      const pfRes = await fetch('https://api.printful.com/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(printfulOrder),
      })

      const pfData = await pfRes.json()

      if (pfRes.ok) {
        console.log(`✅ Printful order created: ${pfData.result?.id} for ${product_name} ${variant_name}`)

        // Confirm/submit the order (moves from draft to processing)
        await fetch(`https://api.printful.com/orders/${pfData.result.id}/confirm`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}` },
        })

        console.log(`✅ Printful order confirmed and submitted to production`)
      } else {
        console.error('Printful order failed:', JSON.stringify(pfData))
      }
    } catch (err) {
      console.error('Error creating Printful order:', err)
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
}

export const config = { path: '/api/stripe-webhook' }
