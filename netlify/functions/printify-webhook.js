/**
 * Printify webhook handler
 * Receives order status updates from Printify and syncs to Dreamscape orders
 */
import { createClient } from '@supabase/supabase-js'

function corsResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export default async (req) => {
  if (req.method !== 'POST') return corsResponse({ error: 'Method not allowed' }, 405)

  try {
    const payload = await req.json()
    const { type, resource } = payload

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log(`[printify-webhook] Event: ${type}`, resource?.id)

    // Map Printify status to Dreamscape status
    const STATUS_MAP = {
      'order:created':            'processing',
      'order:sent-to-production': 'in_production',
      'order:shipment:created':   'shipped',
      'order:shipment:delivered': 'delivered',
      'order:canceled':           'cancelled',
    }

    const newStatus = STATUS_MAP[type]
    if (!newStatus) return corsResponse({ ok: true, skipped: true })

    // Find order by Printify external_id
    const externalId = resource?.external_id
    if (!externalId) return corsResponse({ ok: true, skipped: 'no external_id' })

    // Update order status
    const updateData = {
      fulfillment_status: newStatus,
      updated_at: new Date().toISOString(),
      fulfillment_provider: 'printify',
    }

    // Add tracking info if shipment event
    if (type === 'order:shipment:created' && resource?.shipments?.[0]) {
      const shipment = resource.shipments[0]
      updateData.tracking_number = shipment.tracking_number
      updateData.tracking_url = shipment.url
      updateData.carrier = shipment.carrier
    }

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', externalId)

    if (error) throw error

    // Notify the customer if shipped
    if (type === 'order:shipment:created') {
      const { data: order } = await supabase
        .from('orders')
        .select('user_id, product_title')
        .eq('id', externalId)
        .single()

      if (order?.user_id) {
        await supabase.from('notifications').insert({
          user_id: order.user_id,
          type: 'order_shipped',
          title: '📦 Your order has shipped!',
          message: `${order.product_title || 'Your order'} is on its way. Track it: ${resource?.shipments?.[0]?.url || ''}`,
          resource_id: externalId,
        })
      }
    }

    return corsResponse({ ok: true, status: newStatus })

  } catch (err) {
    console.error('[printify-webhook] Error:', err.message)
    return corsResponse({ error: err.message }, 500)
  }
}

export const config = { path: '/api/printify-webhook' }
