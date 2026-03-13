import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_COLORS = {
  confirmed: C.teal,
  pending: C.gold,
  shipped: C.accent,
  fulfilled: C.teal,
  cancelled: '#ff6b6b',
  failed: '#ff6b6b',
}

const STATUS_LABELS = {
  confirmed: '✦ Confirmed',
  pending: '⏳ Pending',
  shipped: '🚚 Shipped',
  fulfilled: '✅ Delivered',
  cancelled: '✕ Cancelled',
  failed: '✕ Failed',
}

function OrderCard({ order }) {
  const navigate = useNavigate()
  const statusColor = STATUS_COLORS[order.status] || C.muted
  const statusLabel = STATUS_LABELS[order.status] || order.status

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 16, overflow: 'hidden', transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '44'}
      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>

      <div style={{ display: 'flex', gap: 0 }}>
        {/* Product image */}
        <div style={{ width: 120, minHeight: 120, flexShrink: 0, background: `linear-gradient(135deg, ${C.accent}18, ${C.teal}18)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {order.mockup_url
            ? <img src={order.mockup_url} alt={order.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 40 }}>🎨</span>}
        </div>

        {/* Order details */}
        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{order.product_name}</div>
              <span style={{ fontSize: 11, background: statusColor + '20', border: `1px solid ${statusColor}44`, borderRadius: 20, padding: '3px 10px', color: statusColor, fontWeight: 600, flexShrink: 0 }}>
                {statusLabel}
              </span>
            </div>
            {order.variant_name && (
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{order.variant_name}</div>
            )}
            <div style={{ fontSize: 12, color: C.muted }}>
              Qty: {order.quantity || 1} · Ordered {timeAgo(order.created_at)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.gold, fontFamily: 'Playfair Display, serif' }}>
                ${parseFloat(order.amount_total || 0).toFixed(2)}
              </div>
              {order.printful_order_id && (
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Order #{order.printful_order_id}</div>
              )}
            </div>
            {order.shipping_address && (
              <div style={{ fontSize: 11, color: C.muted, textAlign: 'right', lineHeight: 1.5 }}>
                <div>{order.shipping_name}</div>
                <div>{order.shipping_address.city}, {order.shipping_address.country}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OrderHistory({ user, onSignIn }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (user) loadOrders()
    else setLoading(false)
  }, [user])

  const loadOrders = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  if (!user) return (
    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
      <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, marginBottom: 8 }}>Your Orders</h2>
      <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>Sign in to view your order history.</p>
      <button onClick={onSignIn} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '12px 28px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Sign In ✦</button>
    </div>
  )

  return (
    <div style={{ padding: '40px 20px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: C.text, marginBottom: 6 }}>Your Orders</h1>
        <p style={{ color: C.muted, fontSize: 14 }}>Track your Dreamscape purchases and their fulfillment status.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '60px 0' }}>
          <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
          {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
        </div>
      ) : orders.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '64px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📦</div>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text, marginBottom: 8 }}>No orders yet</h3>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
            When you purchase products from the marketplace, they'll appear here.
          </p>
          <button onClick={() => navigate('/marketplace')}
            style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '11px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Browse Marketplace ✦
          </button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>{orders.length} order{orders.length !== 1 ? 's' : ''}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {orders.map(order => <OrderCard key={order.id} order={order} />)}
          </div>
        </>
      )}
    </div>
  )
}
