import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
  red: '#FF4D4D',
}

const TIER_COLORS = { free: C.muted, starter: C.teal, pro: C.accent, studio: C.gold }
const TIERS = ['free', 'starter', 'pro', 'studio']

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'Playfair Display, serif', color: color || C.text }}>{value}</div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '40px 0' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
      {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
    </div>
  )
}

// ── Users Tab ─────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState(null)
  const [confirm, setConfirm] = useState(null) // { type, userId, username, value }

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, subscription_tier, subscription_status, is_suspended, is_admin, created_at')
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  const updateTier = async (userId, tier) => {
    setUpdating(userId)
    await supabase.from('profiles').update({ subscription_tier: tier, subscription_status: tier === 'free' ? 'free' : 'active' }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscription_tier: tier } : u))
    setUpdating(null)
  }

  const toggleSuspend = async (userId, suspended) => {
    setUpdating(userId)
    await supabase.from('profiles').update({ is_suspended: !suspended }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: !suspended } : u))
    setUpdating(null)
    setConfirm(null)
  }

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
          style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 14px', color: C.text, fontSize: 13, outline: 'none', width: 260 }} />
        <div style={{ fontSize: 12, color: C.muted }}>{filtered.length} user{filtered.length !== 1 ? 's' : ''}</div>
      </div>
      {loading ? <Spinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(u => (
            <div key={u.id} style={{ background: C.card, border: `1px solid ${u.is_suspended ? C.red + '44' : C.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {/* Avatar letter */}
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {u.username?.[0]?.toUpperCase() || '?'}
              </div>
              {/* User info */}
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                  {u.display_name || u.username}
                  {u.is_admin && <span style={{ marginLeft: 8, fontSize: 10, background: C.gold + '22', border: `1px solid ${C.gold}44`, borderRadius: 10, padding: '2px 8px', color: C.gold }}>ADMIN</span>}
                  {u.is_suspended && <span style={{ marginLeft: 8, fontSize: 10, background: C.red + '22', border: `1px solid ${C.red}44`, borderRadius: 10, padding: '2px 8px', color: C.red }}>SUSPENDED</span>}
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>@{u.username} · Joined {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              {/* Tier selector */}
              <select value={u.subscription_tier || 'free'} onChange={e => updateTier(u.id, e.target.value)}
                disabled={updating === u.id || u.is_admin}
                style={{ background: C.bg, border: `1px solid ${TIER_COLORS[u.subscription_tier || 'free']}55`, borderRadius: 8, padding: '6px 10px', color: TIER_COLORS[u.subscription_tier || 'free'] || C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                {TIERS.map(t => <option key={t} value={t} style={{ color: C.text, background: C.bg }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
              {/* Suspend button */}
              {!u.is_admin && (
                <button onClick={() => setConfirm({ type: 'suspend', userId: u.id, username: u.username, suspended: u.is_suspended })}
                  disabled={updating === u.id}
                  style={{ background: u.is_suspended ? `${C.teal}20` : `${C.red}18`, border: `1px solid ${u.is_suspended ? C.teal + '44' : C.red + '44'}`, borderRadius: 8, padding: '6px 14px', color: u.is_suspended ? C.teal : C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {u.is_suspended ? 'Unsuspend' : 'Suspend'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Confirm dialog */}
      {confirm?.type === 'suspend' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(8,11,20,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>{confirm.suspended ? '✅' : '🚫'}</div>
            <h3 style={{ color: C.text, marginBottom: 8, fontFamily: 'Playfair Display, serif' }}>{confirm.suspended ? 'Unsuspend' : 'Suspend'} @{confirm.username}?</h3>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
              {confirm.suspended ? 'This will restore their access to Dreamscape.' : 'This will block their access to Dreamscape immediately.'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => toggleSuspend(confirm.userId, confirm.suspended)}
                style={{ flex: 1, background: confirm.suspended ? `linear-gradient(135deg, ${C.teal}, #00A884)` : `linear-gradient(135deg, ${C.red}, #CC0000)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Orders Tab ────────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [dreamscapeRevenue, setDreamscapeRevenue] = useState(0)

  useEffect(() => { loadOrders() }, [])

  const loadOrders = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setOrders(data || [])
    setTotalRevenue(data?.reduce((sum, o) => sum + (o.amount_total || 0), 0) || 0)
    setDreamscapeRevenue(data?.reduce((sum, o) => sum + (o.dreamscape_earnings || 0), 0) || 0)
    setLoading(false)
  }

  const STATUS_COLORS = { confirmed: C.teal, pending: C.gold, shipped: C.accent, fulfilled: C.teal, cancelled: C.red }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Orders" value={orders.length} />
        <StatCard label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} color={C.gold} />
        <StatCard label="Dreamscape Earnings" value={`$${dreamscapeRevenue.toFixed(2)}`} color={C.teal} />
      </div>
      {loading ? <Spinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orders.map(o => (
            <div key={o.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              {o.mockup_url
                ? <img src={o.mockup_url} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 48, height: 48, borderRadius: 8, background: `${C.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🎨</div>
              }
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{o.product_name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{o.shipping_name} · {new Date(o.created_at).toLocaleDateString()}</div>
              </div>
              <span style={{ fontSize: 11, background: (STATUS_COLORS[o.status] || C.muted) + '20', border: `1px solid ${(STATUS_COLORS[o.status] || C.muted)}44`, borderRadius: 20, padding: '3px 10px', color: STATUS_COLORS[o.status] || C.muted, fontWeight: 600 }}>{o.status}</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.gold, fontFamily: 'Playfair Display, serif' }}>${parseFloat(o.amount_total || 0).toFixed(2)}</div>
                {o.dreamscape_earnings != null && <div style={{ fontSize: 11, color: C.teal }}>DS: ${o.dreamscape_earnings?.toFixed(2)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Content Tab ───────────────────────────────────────────────
function ContentTab() {
  const [tab, setTab] = useState('products')
  const [products, setProducts] = useState([])
  const [artworks, setArtworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)

  useEffect(() => { loadContent() }, [])

  const loadContent = async () => {
    setLoading(true)
    const [{ data: prods }, { data: art }] = await Promise.all([
      supabase.from('products').select('*, profiles(username)').order('created_at', { ascending: false }).limit(100),
      supabase.from('artwork').select('*, profiles(username)').order('created_at', { ascending: false }).limit(100),
    ])
    setProducts(prods || [])
    setArtworks(art || [])
    setLoading(false)
  }

  const deleteProduct = async (id) => {
    await supabase.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
    setConfirm(null)
  }

  const deleteArtwork = async (id) => {
    await supabase.from('artwork').delete().eq('id', id)
    setArtworks(prev => prev.filter(a => a.id !== id))
    setConfirm(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {[['products', `Products (${products.length})`], ['artworks', `Artworks (${artworks.length})`]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ background: tab === id ? `${C.accent}20` : 'none', border: `1px solid ${tab === id ? C.accent + '55' : 'transparent'}`, borderRadius: 8, padding: '7px 16px', color: tab === id ? C.accent : C.muted, fontSize: 13, fontWeight: tab === id ? 700 : 400, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(tab === 'products' ? products : artworks).map(item => (
            <div key={item.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {(item.mockup_url || item.image_url)
                ? <img src={item.mockup_url || item.image_url} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 48, height: 48, borderRadius: 8, background: `${C.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🎨</div>
              }
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{item.title}</div>
                <div style={{ fontSize: 11, color: C.muted }}>@{item.profiles?.username} · {new Date(item.created_at).toLocaleDateString()}</div>
              </div>
              {tab === 'products' && <div style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>${parseFloat(item.price || 0).toFixed(2)}</div>}
              <button onClick={() => setConfirm({ type: tab, id: item.id, title: item.title })}
                style={{ background: `${C.red}18`, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '6px 14px', color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(8,11,20,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🗑️</div>
            <h3 style={{ color: C.text, marginBottom: 8, fontFamily: 'Playfair Display, serif' }}>Remove "{confirm.title}"?</h3>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => confirm.type === 'products' ? deleteProduct(confirm.id) : deleteArtwork(confirm.id)}
                style={{ flex: 1, background: `linear-gradient(135deg, ${C.red}, #CC0000)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Admin Dashboard ───────────────────────────────────────────
export default function Admin({ user, profile }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('users')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    // Redirect non-admins
    if (profile && !profile.is_admin) navigate('/')
    if (profile?.is_admin) loadStats()
  }, [profile])

  const loadStats = async () => {
    const [
      { count: userCount },
      { count: orderCount },
      { count: productCount },
      { count: artworkCount },
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact' }),
      supabase.from('orders').select('id', { count: 'exact' }),
      supabase.from('products').select('id', { count: 'exact' }),
      supabase.from('artwork').select('id', { count: 'exact' }),
    ])
    setStats({ userCount, orderCount, productCount, artworkCount })
  }

  if (!profile?.is_admin) return null

  const tabs = [['users', '👥 Users'], ['orders', '📦 Orders'], ['content', '🎨 Content']]

  return (
    <div style={{ padding: '40px 20px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Admin Dashboard</div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: C.text, marginBottom: 4 }}>Dreamscape Control Center</h1>
        <p style={{ color: C.muted, fontSize: 13 }}>Founder access · @{profile?.username}</p>
      </div>

      {/* Stats row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 32 }}>
          <StatCard label="Total Users" value={stats.userCount} />
          <StatCard label="Total Orders" value={stats.orderCount} color={C.gold} />
          <StatCard label="Products Listed" value={stats.productCount} color={C.accent} />
          <StatCard label="Artworks Created" value={stats.artworkCount} color={C.teal} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === id ? C.accent : 'transparent'}`, padding: '10px 18px', color: tab === id ? C.accent : C.muted, fontSize: 13, fontWeight: tab === id ? 700 : 400, cursor: 'pointer', marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'content' && <ContentTab />}
    </div>
  )
}
