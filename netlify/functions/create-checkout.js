import Stripe from 'stripe'

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  try {
    const body = await req.json()
    const { productName, variantName, price, imageUrl, printfulProductId, printfulVariantId, quantity = 1, shippingRequired = true } = body

    if (!productName || !price) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: variantName || undefined,
              images: imageUrl ? [imageUrl] : [],
            },
            unit_amount: Math.round(price * 100), // convert dollars to cents
          },
          quantity,
        },
      ],
      mode: 'payment',
      shipping_address_collection: shippingRequired ? {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'NO', 'DK', 'FI', 'JP', 'SG', 'NZ'],
      } : undefined,
      metadata: {
        printful_product_id: String(printfulProductId || ''),
        printful_variant_id: String(printfulVariantId || ''),
        product_name: productName,
        variant_name: variantName || '',
        quantity: String(quantity),
      },
      success_url: `${process.env.URL || 'https://trydreamscape.com'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL || 'https://trydreamscape.com'}/marketplace`,
    })

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}

export const config = { path: '/api/create-checkout' }
