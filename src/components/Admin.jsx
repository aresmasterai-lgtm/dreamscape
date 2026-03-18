import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
  red: '#FF4D4D',
}

function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
      </div>
    </div>
  )
}

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || C.text, fontFamily: 'Playfair Display, serif' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── Tier config ───────────────────────────────────────────────
const TIERS = ['free', 'starter', 'pro', 'studio']
const TIER_BENEFITS = {
  free:    { gens: 10,  products: 3,  label: 'Free',    color: C.muted },
  starter: { gens: 50,  products: 15, label: 'Starter', color: C.teal },
  pro:     { gens: 200, products: 50, label: 'Pro',     color: C.accent },
  studio:  { gens: '∞', products: '∞',label: 'Studio',  color: C.gold },
}

// ── Tier Modal ────────────────────────────────────────────────
function TierModal({ confirm, TIERS, TIER_BENEFITS, updating, onUpdate, onClose }) {
  const [selected, setSelected] = useState(confirm.currentTier)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(8,11,20,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', maxWidth: 440, width: '100%' }}>
        <h3 style={{ color: C.text, marginBottom: 4, fontFamily: 'Playfair Display, serif' }}>Change Tier — @{confirm.username}</h3>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Current: <strong style={{ color: TIER_BENEFITS[confirm.currentTier]?.color }}>{TIER_BENEFITS[confirm.currentTier]?.label}</strong></p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {TIERS.map(tier => (
            <button key={tier} onClick={() => setSelected(tier)}
              style={{ background: selected === tier ? `${TIER_BENEFITS[tier]?.color}20` : C.bg, border: `1px solid ${selected === tier ? TIER_BENEFITS[tier]?.color + '66' : C.border}`, borderRadius: 10, padding: '12px 16px', color: selected === tier ? TIER_BENEFITS[tier]?.color : C.muted, fontSize: 13, fontWeight: selected === tier ? 700 : 400, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
              <span>{TIER_BENEFITS[tier]?.label}</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>{TIER_BENEFITS[tier]?.gens} gens · {TIER_BENEFITS[tier]?.products} products/mo</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onUpdate(confirm.userId, selected)} disabled={updating === confirm.userId || selected === confirm.currentTier}
            style={{ flex: 2, background: selected !== confirm.currentTier ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : C.border, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: selected !== confirm.currentTier ? 'pointer' : 'not-allowed' }}>
            {updating === confirm.userId ? 'Updating...' : 'Apply Change'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Users Tab ─────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [confirm, setConfirm] = useState(null)
  const [updating, setUpdating] = useState(null)

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setUsers(data || [])
    setLoading(false)
  }

  const updateTier = async (userId, tier) => {
    setUpdating(userId)
    await supabase.from('profiles').update({ subscription_tier: tier }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscription_tier: tier } : u))
    setUpdating(null)
    setConfirm(null)
  }

  const toggleSuspend = async (userId, isSuspended) => {
    setUpdating(userId)
    await supabase.from('profiles').update({ is_suspended: !isSuspended }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: !isSuspended } : u))
    setUpdating(null)
    setConfirm(null)
  }

  const filtered = users.filter(u => {
    const matchSearch = !search || u.username?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
    const matchTier = tierFilter === 'all' || u.subscription_tier === tierFilter
    return matchSearch && matchTier
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username or email..."
          style={{ flex: 1, minWidth: 180, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 14px', color: C.text, fontSize: 13, outline: 'none' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', ...TIERS].map(t => (
            <button key={t} onClick={() => setTierFilter(t)}
              style={{ background: tierFilter === t ? `${C.accent}20` : 'none', border: `1px solid ${tierFilter === t ? C.accent + '55' : C.border}`, borderRadius: 8, padding: '6px 12px', color: tierFilter === t ? C.accent : C.muted, fontSize: 12, fontWeight: tierFilter === t ? 700 : 400, cursor: 'pointer' }}>
              {t === 'all' ? 'All' : TIER_BENEFITS[t]?.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.muted }}>{filtered.length} users</div>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(u => {
            const tierMeta = TIER_BENEFITS[u.subscription_tier || 'free']
            return (
              <div key={u.id} style={{ background: C.card, border: `1px solid ${u.is_suspended ? C.red + '33' : C.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                {u.avatar_url
                  ? <img src={u.avatar_url} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt={u.username} />
                  : <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${C.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.accent, flexShrink: 0 }}>{u.username?.[0]?.toUpperCase() || '?'}</div>
                }
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: u.is_suspended ? C.red : C.text }}>
                    @{u.username || 'no username'} {u.is_admin && <span style={{ fontSize: 10, background: `${C.gold}20`, color: C.gold, borderRadius: 6, padding: '1px 6px', marginLeft: 4 }}>admin</span>}
                    {u.is_suspended && <span style={{ fontSize: 10, background: `${C.red}20`, color: C.red, borderRadius: 6, padding: '1px 6px', marginLeft: 4 }}>suspended</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>{new Date(u.created_at).toLocaleDateString()} · {u.date_of_birth ? '✅ DOB on file' : '⚠️ No DOB'}</div>
                </div>
                <span style={{ fontSize: 11, background: `${tierMeta?.color}20`, border: `1px solid ${tierMeta?.color}44`, borderRadius: 20, padding: '3px 10px', color: tierMeta?.color, fontWeight: 700 }}>{tierMeta?.label}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setConfirm({ type: 'tier', userId: u.id, username: u.username, currentTier: u.subscription_tier || 'free' })}
                    style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: '6px 12px', color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Change Tier
                  </button>
                  {!u.is_admin && (
                    <button onClick={() => setConfirm({ type: 'suspend', userId: u.id, username: u.username, suspended: u.is_suspended })}
                      disabled={updating === u.id}
                      style={{ background: u.is_suspended ? `${C.teal}20` : '#FF4D4D18', border: `1px solid ${u.is_suspended ? C.teal + '44' : '#FF4D4D44'}`, borderRadius: 8, padding: '6px 14px', color: u.is_suspended ? C.teal : '#FF4D4D', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {u.is_suspended ? 'Unsuspend' : 'Suspend'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirm?.type === 'tier' && (
        <TierModal confirm={confirm} TIERS={TIERS} TIER_BENEFITS={TIER_BENEFITS} updating={updating} onUpdate={updateTier} onClose={() => setConfirm(null)} />
      )}

      {confirm?.type === 'suspend' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(8,11,20,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>{confirm.suspended ? '✅' : '🚫'}</div>
            <h3 style={{ color: C.text, marginBottom: 8, fontFamily: 'Playfair Display, serif' }}>{confirm.suspended ? 'Unsuspend' : 'Suspend'} @{confirm.username}?</h3>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
              {confirm.suspended ? 'This will restore full access to Dreamscape immediately.' : 'This will block their access to Dreamscape immediately.'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => toggleSuspend(confirm.userId, confirm.suspended)}
                style={{ flex: 1, background: confirm.suspended ? `linear-gradient(135deg, ${C.teal}, #00A884)` : 'linear-gradient(135deg, #FF4D4D, #CC0000)', border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
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
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100)
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
                ? <img src={o.mockup_url} alt={o.product_name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
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
                ? <img src={item.mockup_url || item.image_url} alt={item.title} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 48, height: 48, borderRadius: 8, background: `${C.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🎨</div>
              }
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{item.title}</div>
                <div style={{ fontSize: 11, color: C.muted }}>@{item.profiles?.username} · {new Date(item.created_at).toLocaleDateString()}</div>
              </div>
              {tab === 'products' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>${parseFloat(item.price || 0).toFixed(2)}</div>
                  {item.is_hidden && <div style={{ fontSize: 11, background: `${C.red}20`, border: `1px solid ${C.red}44`, borderRadius: 20, padding: '2px 8px', color: C.red, fontWeight: 600 }}>Hidden</div>}
                </div>
              )}
              {tab === 'artworks' && <div style={{ fontSize: 11, background: item.is_public ? `${C.teal}20` : `${C.muted}20`, border: `1px solid ${item.is_public ? C.teal + '44' : C.muted + '33'}`, borderRadius: 20, padding: '3px 10px', color: item.is_public ? C.teal : C.muted, fontWeight: 600 }}>{item.is_public ? '🌐 Public' : '🔒 Private'}</div>}
              {/* Unpublish — artwork only */}
              {tab === 'artworks' && item.is_public && (
                <button onClick={async () => {
                  await supabase.from('artwork').update({ is_public: false }).eq('id', item.id)
                  setArtworks(prev => prev.map(a => a.id === item.id ? { ...a, is_public: false } : a))
                }}
                  style={{ background: `${C.gold}15`, border: `1px solid ${C.gold}44`, borderRadius: 8, padding: '6px 14px', color: C.gold, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  🔒 Unpublish
                </button>
              )}
              {tab === 'artworks' && !item.is_public && (
                <button onClick={async () => {
                  await supabase.from('artwork').update({ is_public: true }).eq('id', item.id)
                  setArtworks(prev => prev.map(a => a.id === item.id ? { ...a, is_public: true } : a))
                }}
                  style={{ background: `${C.teal}15`, border: `1px solid ${C.teal}44`, borderRadius: 8, padding: '6px 14px', color: C.teal, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  🌐 Publish
                </button>
              )}
              {/* Hide/show products */}
              {tab === 'products' && (
                <button onClick={async () => {
                  const newVal = !item.is_hidden
                  await supabase.from('products').update({ is_hidden: newVal }).eq('id', item.id)
                  setProducts(prev => prev.map(p => p.id === item.id ? { ...p, is_hidden: newVal } : p))
                }}
                  style={{ background: item.is_hidden ? `${C.teal}15` : `${C.gold}15`, border: `1px solid ${item.is_hidden ? C.teal + '44' : C.gold + '44'}`, borderRadius: 8, padding: '6px 14px', color: item.is_hidden ? C.teal : C.gold, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {item.is_hidden ? '👁 Show' : '🔒 Hide'}
                </button>
              )}
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
                style={{ flex: 1, background: `linear-gradient(135deg, ${C.red}, #CC0000)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────
function OverviewTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [topCreators, setTopCreators] = useState([])
  const [recentUsers, setRecentUsers] = useState([])
  const [dailyGens, setDailyGens] = useState([])

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const startOfWeek = new Date(now - 7 * 86400000).toISOString()

    const [
      { count: totalUsers },
      { count: totalArtworks },
      { count: totalProducts },
      { count: totalOrders },
      { count: newUsersWeek },
      { count: gensMonth },
      { data: tierData },
      { data: creators },
      { data: recent },
      { data: orders },
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('artwork').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', startOfWeek),
      supabase.from('artwork').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
      supabase.from('profiles').select('subscription_tier'),
      supabase.from('profiles').select('id, username, avatar_url').limit(200),
      supabase.from('profiles').select('id, username, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('orders').select('amount_total, created_at').gte('created_at', startOfMonth),
    ])

    // Tier breakdown
    const tiers = { free: 0, starter: 0, pro: 0, studio: 0 }
    tierData?.forEach(p => { const t = p.subscription_tier || 'free'; tiers[t] = (tiers[t] || 0) + 1 })

    // Monthly revenue
    const monthRevenue = orders?.reduce((sum, o) => sum + (o.amount_total || 0), 0) || 0

    setData({ totalUsers, totalArtworks, totalProducts, totalOrders, newUsersWeek, gensMonth, tiers, monthRevenue })
    setRecentUsers(recent || [])

    // Top creators by artwork count — fetch artwork counts per user
    const { data: artworkCounts } = await supabase
      .from('artwork')
      .select('user_id, profiles(username, avatar_url)')
      .limit(500)

    const countMap = {}
    artworkCounts?.forEach(a => {
      const id = a.user_id
      if (!countMap[id]) countMap[id] = { count: 0, username: a.profiles?.username, avatar: a.profiles?.avatar_url }
      countMap[id].count++
    })
    const sorted = Object.entries(countMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5)
    setTopCreators(sorted.map(([id, v]) => ({ id, ...v })))

    // Daily generations last 7 days
    const { data: recentArt } = await supabase
      .from('artwork')
      .select('created_at')
      .gte('created_at', startOfWeek)
      .order('created_at', { ascending: true })

    const dayMap = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000)
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      dayMap[key] = 0
    }
    recentArt?.forEach(a => {
      const key = new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (key in dayMap) dayMap[key]++
    })
    setDailyGens(Object.entries(dayMap).map(([day, count]) => ({ day, count })))

    setLoading(false)
  }

  if (loading) return <Spinner />

  const maxGen = Math.max(...dailyGens.map(d => d.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Key stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <StatCard label="Total Users" value={data.totalUsers} sub={`+${data.newUsersWeek} this week`} />
        <StatCard label="Artworks Generated" value={data.totalArtworks} sub={`${data.gensMonth} this month`} color={C.teal} />
        <StatCard label="Products Listed" value={data.totalProducts} color={C.accent} />
        <StatCard label="Total Orders" value={data.totalOrders} color={C.gold} sub={`$${data.monthRevenue.toFixed(2)} this month`} />
      </div>

      {/* Tier breakdown + daily chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Tier breakdown */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Subscription Tiers</div>
          {TIERS.map(tier => {
            const count = data.tiers[tier] || 0
            const pct = data.totalUsers ? Math.round((count / data.totalUsers) * 100) : 0
            return (
              <div key={tier} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: TIER_BENEFITS[tier]?.color, fontWeight: 600 }}>{TIER_BENEFITS[tier]?.label}</span>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{count} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>({pct}%)</span></span>
                </div>
                <div style={{ height: 6, background: C.bg, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: TIER_BENEFITS[tier]?.color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Daily generations chart */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Generations — Last 7 Days</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
            {dailyGens.map(({ day, count }) => (
              <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10, color: C.muted }}>{count || ''}</div>
                <div style={{ width: '100%', background: count > 0 ? `linear-gradient(180deg, ${C.accent}, #4B2FD0)` : C.border, borderRadius: '4px 4px 0 0', height: `${Math.max(4, (count / maxGen) * 60)}px`, transition: 'height 0.4s ease' }} />
                <div style={{ fontSize: 9, color: C.muted, whiteSpace: 'nowrap' }}>{day}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top creators + recent signups */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>🏆 Top Creators</div>
          {topCreators.length === 0 && <p style={{ fontSize: 13, color: C.muted }}>No data yet.</p>}
          {topCreators.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: [C.gold, C.muted, C.muted][i] || C.muted, width: 16 }}>#{i + 1}</span>
              {c.avatar
                ? <img src={c.avatar} alt={c.username} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${C.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.accent, fontWeight: 700 }}>{c.username?.[0]?.toUpperCase()}</div>
              }
              <span style={{ flex: 1, fontSize: 13, color: C.text }}>@{c.username || 'unknown'}</span>
              <span style={{ fontSize: 13, color: C.teal, fontWeight: 700 }}>{c.count} artworks</span>
            </div>
          ))}
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>🆕 Recent Signups</div>
          {recentUsers.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${C.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.accent, fontWeight: 700 }}>{u.username?.[0]?.toUpperCase() || '?'}</div>
              <span style={{ flex: 1, fontSize: 13, color: C.text }}>@{u.username || 'no username'}</span>
              <span style={{ fontSize: 11, color: C.muted }}>{new Date(u.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Compliance Tab ────────────────────────────────────────────
function ComplianceTab() {
  const [noDob, setNoDob] = useState([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ total: 0, withDob: 0, noDob: 0, suspended: 0 })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data: all } = await supabase.from('profiles').select('id, username, email, created_at, date_of_birth, is_suspended, subscription_tier').order('created_at', { ascending: false })
    const users = all || []
    const missing = users.filter(u => !u.date_of_birth)
    const withDob = users.filter(u => !!u.date_of_birth)
    setNoDob(missing)
    setSummary({ total: users.length, withDob: withDob.length, noDob: missing.length, suspended: users.filter(u => u.is_suspended).length })
    setLoading(false)
  }

  if (loading) return <Spinner />

  const pct = summary.total ? Math.round((summary.withDob / summary.total) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <StatCard label="Total Users" value={summary.total} />
        <StatCard label="DOB on File" value={summary.withDob} color={C.teal} sub={`${pct}% compliance`} />
        <StatCard label="No DOB" value={summary.noDob} color={summary.noDob > 0 ? C.gold : C.teal} sub="Signed up pre-gate or skipped" />
        <StatCard label="Suspended" value={summary.suspended} color={summary.suspended > 0 ? C.red : C.muted} />
      </div>

      {/* DOB compliance bar */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Age Verification Coverage</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: pct >= 80 ? C.teal : pct >= 50 ? C.gold : C.red }}>{pct}%</span>
        </div>
        <div style={{ height: 10, background: C.bg, borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? `linear-gradient(90deg, ${C.teal}, #00A884)` : pct >= 50 ? `linear-gradient(90deg, ${C.gold}, #e0a800)` : `linear-gradient(90deg, ${C.red}, #cc0000)`, borderRadius: 5, transition: 'width 0.6s' }} />
        </div>
        <p style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
          {pct >= 80 ? '✅ Strong compliance. Most users have verified age on file.' : pct >= 50 ? '⚠️ Moderate compliance. Consider prompting older accounts to add their DOB.' : '🚨 Low compliance. Age gate was recently added — legacy accounts need follow-up.'}
        </p>
      </div>

      {/* Users without DOB */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
          Users Without DOB on File ({noDob.length})
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 8 }}>— These users signed up before age verification was added or signed in via OAuth</span>
        </div>
        {noDob.length === 0 ? (
          <div style={{ background: `${C.teal}12`, border: `1px solid ${C.teal}33`, borderRadius: 12, padding: '20px', textAlign: 'center' }}>
            <p style={{ color: C.teal, fontSize: 14, fontWeight: 600 }}>✅ All users have a date of birth on file.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
            {noDob.map(u => (
              <div key={u.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${C.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: C.gold, fontWeight: 700, flexShrink: 0 }}>⚠️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>@{u.username || 'no username'}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Joined {new Date(u.created_at).toLocaleDateString()} · {TIER_BENEFITS[u.subscription_tier || 'free']?.label}</div>
                </div>
                {u.is_suspended && <span style={{ fontSize: 10, background: `${C.red}20`, color: C.red, borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>Suspended</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legal note */}
      <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}30`, borderRadius: 12, padding: '16px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 6 }}>⚖️ Legal Protection Status</div>
        <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, margin: 0 }}>
          Dreamscape's age gate collects and records date of birth before access is granted. Users who provide false DOB data to circumvent the gate are explicitly warned this violates Terms of Service — this warning is displayed at the gate and shifts legal liability to the user. Stripe Connect handles KYC identity verification for all creators who receive payouts, providing an additional age verification layer for the seller side. Google OAuth verification is pending — once approved, the "Unverified" label on OAuth sign-ins will be removed.
        </p>
      </div>
    </div>
  )
}

// ── Generation Stats Tab ──────────────────────────────────────
function StatsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const GEMINI_COST_PER_GEN = 0.02 // estimated $ per image generation

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

    const [
      { count: totalAllTime },
      { count: thisMonth },
      { count: lastMonth },
      { data: tierArtwork },
      { data: daily },
    ] = await Promise.all([
      supabase.from('artwork').select('id', { count: 'exact', head: true }),
      supabase.from('artwork').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
      supabase.from('artwork').select('id', { count: 'exact', head: true }).gte('created_at', startOfLastMonth).lt('created_at', startOfMonth),
      supabase.from('artwork').select('user_id, profiles(subscription_tier)').gte('created_at', startOfMonth).limit(2000),
      supabase.from('artwork').select('created_at').gte('created_at', new Date(now - 30 * 86400000).toISOString()).order('created_at', { ascending: true }),
    ])

    // Gens by tier this month
    const byTier = { free: 0, starter: 0, pro: 0, studio: 0 }
    tierArtwork?.forEach(a => {
      const t = a.profiles?.subscription_tier || 'free'
      byTier[t] = (byTier[t] || 0) + 1
    })

    // Daily breakdown last 30 days
    const dayMap = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000)
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      dayMap[key] = 0
    }
    daily?.forEach(a => {
      const key = new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (key in dayMap) dayMap[key]++
    })

    const monthGrowth = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null

    setData({
      totalAllTime, thisMonth, lastMonth, monthGrowth,
      estimatedCostMonth: (thisMonth * GEMINI_COST_PER_GEN).toFixed(2),
      estimatedCostAllTime: (totalAllTime * GEMINI_COST_PER_GEN).toFixed(2),
      byTier,
      dailyData: Object.entries(dayMap).map(([day, count]) => ({ day, count })),
    })
    setLoading(false)
  }

  if (loading) return <Spinner />

  const maxDay = Math.max(...data.dailyData.map(d => d.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Key stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <StatCard label="Total Generations" value={data.totalAllTime?.toLocaleString()} sub={`~$${data.estimatedCostAllTime} total API cost`} />
        <StatCard label="This Month" value={data.thisMonth?.toLocaleString()} color={C.teal}
          sub={data.monthGrowth !== null ? `${data.monthGrowth >= 0 ? '+' : ''}${data.monthGrowth}% vs last month` : 'First month of data'} />
        <StatCard label="Last Month" value={data.lastMonth?.toLocaleString()} color={C.muted} />
        <StatCard label="Est. API Cost (Month)" value={`$${data.estimatedCostMonth}`} color={C.gold} sub="~$0.02/generation (Gemini)" />
      </div>

      {/* By tier */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Generations This Month by Tier</div>
        {TIERS.map(tier => {
          const count = data.byTier[tier] || 0
          const pct = data.thisMonth ? Math.round((count / data.thisMonth) * 100) : 0
          return (
            <div key={tier} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: TIER_BENEFITS[tier]?.color, fontWeight: 600 }}>{TIER_BENEFITS[tier]?.label}</span>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{count.toLocaleString()} <span style={{ fontSize: 11, color: C.muted }}>({pct}%)</span></span>
              </div>
              <div style={{ height: 6, background: C.bg, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: TIER_BENEFITS[tier]?.color, borderRadius: 3 }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* 30-day chart */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Daily Generations — Last 30 Days</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, overflowX: 'auto' }}>
          {data.dailyData.map(({ day, count }, i) => (
            <div key={day} title={`${day}: ${count}`} style={{ flex: '0 0 auto', width: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', background: count > 0 ? `linear-gradient(180deg, ${C.accent}, #4B2FD0)` : C.border, borderRadius: '3px 3px 0 0', height: `${Math.max(3, (count / maxDay) * 80)}px` }} />
              {i % 5 === 0 && <div style={{ fontSize: 8, color: C.muted, whiteSpace: 'nowrap', transform: 'rotate(-45deg)', transformOrigin: 'top left', marginTop: 4 }}>{day}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* API cost note */}
      <div style={{ background: `${C.gold}10`, border: `1px solid ${C.gold}30`, borderRadius: 12, padding: '14px 18px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 4 }}>💡 Cost Estimation Note</div>
        <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, margin: 0 }}>
          API cost estimates use $0.02/generation (approximate Gemini 3.1 Flash Image rate). Actual costs vary based on prompt length, reference images, and retry attempts. Check your Google Cloud billing console for exact figures.
        </p>
      </div>
    </div>
  )
}

// ── Announcements Tab ─────────────────────────────────────────
function AnnouncementsTab() {
  const [message, setMessage] = useState('')
  const [type, setType] = useState('info') // 'info' | 'success' | 'warning'
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const TYPE_CONFIG = {
    info:    { label: 'Info',    color: C.accent, bg: `${C.accent}15`, icon: '📢' },
    success: { label: 'Success', color: C.teal,   bg: `${C.teal}15`,   icon: '✅' },
    warning: { label: 'Warning', color: C.gold,   bg: `${C.gold}15`,   icon: '⚠️' },
  }

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('site_settings').select('*').in('key', ['announcement_message', 'announcement_type', 'announcement_active'])
    const get = (key) => data?.find(d => d.key === key)?.value
    setMessage(get('announcement_message') || '')
    setType(get('announcement_type') || 'info')
    setActive(get('announcement_active') === 'true')
    setLoading(false)
  }

  const save = async () => {
    setSaving(true)
    await Promise.all([
      supabase.from('site_settings').upsert({ key: 'announcement_message', value: message, updated_at: new Date().toISOString() }),
      supabase.from('site_settings').upsert({ key: 'announcement_type', value: type, updated_at: new Date().toISOString() }),
      supabase.from('site_settings').upsert({ key: 'announcement_active', value: String(active), updated_at: new Date().toISOString() }),
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <Spinner />

  const cfg = TYPE_CONFIG[type]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '24px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Site-Wide Banner</h3>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Show a message across the top of Dreamscape for all visitors. No deploy needed.</p>

        {/* Active toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Banner Status</div>
            <div style={{ fontSize: 12, color: C.muted }}>Toggle to show or hide the announcement</div>
          </div>
          <button onClick={() => setActive(a => !a)}
            style={{ background: active ? `${C.teal}25` : C.card, border: `2px solid ${active ? C.teal : C.border}`, borderRadius: 24, padding: '6px 20px', color: active ? C.teal : C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
            {active ? '● Active' : '○ Inactive'}
          </button>
        </div>

        {/* Type selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>Banner Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <button key={key} onClick={() => setType(key)}
                style={{ background: type === key ? `${cfg.color}20` : 'none', border: `1px solid ${type === key ? cfg.color + '66' : C.border}`, borderRadius: 8, padding: '8px 16px', color: type === key ? cfg.color : C.muted, fontSize: 13, fontWeight: type === key ? 700 : 400, cursor: 'pointer' }}>
                {cfg.icon} {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message input */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            Message
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: message.length > 140 ? C.red : C.muted }}>{message.length}/140</span>
          </label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={140} rows={2}
            placeholder="e.g. 🎉 Dreamscape is now on Android! Download the app at trydreamscape.com"
            style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>

        {/* Preview */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Preview</div>
          <div style={{ background: cfg.bg, border: `1px solid ${cfg.color}44`, borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>{cfg.icon}</span>
            <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{message || 'Your announcement will appear here...'}</span>
            <button style={{ background: 'none', border: 'none', color: C.muted, fontSize: 16, cursor: 'pointer', padding: 0 }}>✕</button>
          </div>
        </div>

        <button onClick={save} disabled={saving || !message.trim()}
          style={{ background: !message.trim() ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '12px 28px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: !message.trim() ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving...' : saved ? '✅ Saved!' : '💾 Save Banner'}
        </button>
      </div>

      {/* Integration note */}
      <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}30`, borderRadius: 12, padding: '16px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 6 }}>🔧 To display the banner in the app</div>
        <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, margin: 0 }}>
          Add this to your <code style={{ background: C.bg, padding: '1px 6px', borderRadius: 4, color: C.teal }}>App.jsx</code> near the top of the main <code style={{ background: C.bg, padding: '1px 6px', borderRadius: 4, color: C.teal }}>App()</code> component. It reads from Supabase on load and shows/hides automatically based on the active flag you set here.
        </p>
        <pre style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', fontSize: 11, color: C.teal, marginTop: 10, lineHeight: 1.7, overflowX: 'auto' }}>{`// In App.jsx — add near top of App() component:
const [banner, setBanner] = useState(null)
useEffect(() => {
  supabase.from('site_settings')
    .select('*').in('key', ['announcement_message','announcement_type','announcement_active'])
    .then(({ data }) => {
      const get = k => data?.find(d => d.key === k)?.value
      if (get('announcement_active') === 'true' && get('announcement_message'))
        setBanner({ message: get('announcement_message'), type: get('announcement_type') || 'info' })
    })
}, [])

// Then in your return JSX, above <Navbar>:
{banner && (
  <div style={{ background: banner.type === 'success' ? '#00D4AA15' : banner.type === 'warning' ? '#F5C84215' : '#7C5CFC15',
    borderBottom: '1px solid #1E2A40', padding: '10px 20px', textAlign: 'center',
    fontSize: 13, color: '#E8EAF0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
    {banner.message}
    <button onClick={() => setBanner(null)} style={{ background: 'none', border: 'none', color: '#6B7494', cursor: 'pointer', marginLeft: 8 }}>✕</button>
  </div>
)}`}</pre>
      </div>
    </div>
  )
}

// ── Blog Tab ──────────────────────────────────────────────────
function renderMarkdownPreview(content) {
  if (!content) return []
  const lines = content.split('\n')
  const elements = []
  let i = 0, k = 0
  const key = () => k++

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }
    if (line.startsWith('# ')) { elements.push(<h1 key={key()} style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 900, color: C.text, marginBottom: 12, marginTop: 24 }}>{line.slice(2)}</h1>); i++; continue }
    if (line.startsWith('## ')) { elements.push(<h2 key={key()} style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 10, marginTop: 28 }}>{line.slice(3)}</h2>); i++; continue }
    if (line.startsWith('### ')) { elements.push(<h3 key={key()} style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 8, marginTop: 20 }}>{line.slice(4)}</h3>); i++; continue }
    if (line.startsWith('> [!TIP]')) {
      const tips = []; i++
      while (i < lines.length && lines[i].startsWith('> ')) { tips.push(lines[i].slice(2)); i++ }
      elements.push(<div key={key()} style={{ background: `${C.teal}15`, border: `1px solid ${C.teal}44`, borderLeft: `4px solid ${C.teal}`, borderRadius: '0 10px 10px 0', padding: '14px 18px', marginBottom: 16 }}><div style={{ fontSize: 10, fontWeight: 700, color: C.teal, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>💡 Tip</div><div style={{ color: C.text, fontSize: 13, lineHeight: 1.7 }}>{tips.join(' ')}</div></div>)
      continue
    }
    if (line.startsWith('> [!WARNING]')) {
      const warns = []; i++
      while (i < lines.length && lines[i].startsWith('> ')) { warns.push(lines[i].slice(2)); i++ }
      elements.push(<div key={key()} style={{ background: `${C.gold}15`, border: `1px solid ${C.gold}44`, borderLeft: `4px solid ${C.gold}`, borderRadius: '0 10px 10px 0', padding: '14px 18px', marginBottom: 16 }}><div style={{ fontSize: 10, fontWeight: 700, color: C.gold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>⚠️ Note</div><div style={{ color: C.text, fontSize: 13, lineHeight: 1.7 }}>{warns.join(' ')}</div></div>)
      continue
    }
    if (line.startsWith('> ')) {
      const qs = []; while (i < lines.length && lines[i].startsWith('> ')) { qs.push(lines[i].slice(2)); i++ }
      elements.push(<blockquote key={key()} style={{ borderLeft: `3px solid ${C.accent}`, paddingLeft: 16, margin: '16px 0', color: C.muted, fontStyle: 'italic', fontSize: 15, lineHeight: 1.7 }}>{qs.join(' ')}</blockquote>)
      continue
    }
    if (line.startsWith('```')) {
      const code = []; i++
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++ }
      i++
      elements.push(<pre key={key()} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 16, fontFamily: 'monospace', fontSize: 12, color: C.teal, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{code.join('\n')}</pre>)
      continue
    }
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgMatch) { elements.push(<img key={key()} src={imgMatch[2]} alt={imgMatch[1]} style={{ width: '100%', borderRadius: 10, marginBottom: 16 }} />); i++; continue }
    if (line.trim() === '[PROMPT]') {
      const pl = []; i++
      while (i < lines.length && lines[i].trim() !== '[/PROMPT]') { pl.push(lines[i]); i++ }
      i++
      elements.push(<div key={key()} style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: '16px 20px', margin: '16px 0' }}><div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>✦ Example Prompt</div><pre style={{ fontFamily: 'monospace', fontSize: 13, color: C.text, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{pl.join('\n')}</pre></div>)
      continue
    }
    if (line.trim() === '---') { elements.push(<div key={key()} style={{ height: 1, background: C.border, margin: '20px 0' }} />); i++; continue }
    if (line.match(/^[-*] /)) {
      const items = []; while (i < lines.length && lines[i].match(/^[-*] /)) { items.push(lines[i].slice(2)); i++ }
      elements.push(<ul key={key()} style={{ margin: '8px 0 16px', paddingLeft: 0, listStyle: 'none' }}>{items.map((it, idx) => <li key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 14, color: C.text, lineHeight: 1.6 }}><span style={{ color: C.accent, flexShrink: 0 }}>✦</span><span>{it}</span></li>)}</ul>)
      continue
    }
    if (line.match(/^\d+\. /)) {
      const items = []; while (i < lines.length && lines[i].match(/^\d+\. /)) { items.push(lines[i].replace(/^\d+\. /, '')); i++ }
      elements.push(<ol key={key()} style={{ margin: '8px 0 16px', paddingLeft: 0, listStyle: 'none' }}>{items.map((it, idx) => <li key={idx} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 14, color: C.text, lineHeight: 1.6 }}><span style={{ background: `${C.accent}20`, borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: C.accent, flexShrink: 0 }}>{idx+1}</span><span>{it}</span></li>)}</ol>)
      continue
    }
    const paraLines = []
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('>') && !lines[i].startsWith('```') && !lines[i].match(/^[-*] /) && !lines[i].match(/^\d+\. /) && lines[i].trim() !== '---' && lines[i].trim() !== '[PROMPT]' && !lines[i].match(/^!\[/)) {
      paraLines.push(lines[i]); i++
    }
    if (paraLines.length) elements.push(<p key={key()} style={{ fontSize: 14, color: C.text, lineHeight: 1.8, marginBottom: 16 }}>{paraLines.join(' ')}</p>)
  }
  return elements
}

function BlogTab() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [previewing, setPreviewing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [editMode, setEditMode] = useState('edit')

  const CATEGORIES = ['Prompting Guides', 'Dream AI Tips & Tricks', 'Artist Spotlights', 'Merch & Product Guides', 'Platform Updates & News']

  useEffect(() => { loadPosts() }, [])

  const loadPosts = async () => {
    setLoading(true)
    const { data } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }

  const togglePublish = async (post) => {
    const newStatus = post.status === 'published' ? 'draft' : 'published'
    const updates = { status: newStatus }
    if (newStatus === 'published' && !post.published_at) updates.published_at = new Date().toISOString()
    await supabase.from('blog_posts').update(updates).eq('id', post.id)
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, ...updates } : p))
  }

  const toggleFeatured = async (post) => {
    if (!post.featured) await supabase.from('blog_posts').update({ featured: false }).neq('id', post.id)
    await supabase.from('blog_posts').update({ featured: !post.featured }).eq('id', post.id)
    loadPosts()
  }

  const deletePost = async (id) => {
    await supabase.from('blog_posts').delete().eq('id', id)
    setPosts(prev => prev.filter(p => p.id !== id))
    setConfirm(null)
  }

  const savePost = async (status) => {
    if (!editing.title || !editing.slug) return
    setSaving(true)
    const updates = { ...editing, status: status || editing.status, updated_at: new Date().toISOString() }
    if (status === 'published' && !editing.published_at) updates.published_at = new Date().toISOString()
    if (editing.id) await supabase.from('blog_posts').update(updates).eq('id', editing.id)
    else await supabase.from('blog_posts').insert(updates)
    setSaving(false)
    setEditing(null)
    setEditMode('edit')
    loadPosts()
  }

  const newPost = () => {
    setEditing({ title: '', slug: '', excerpt: '', content: '', category: CATEGORIES[0], cover_image: '', author: 'Dream AI', status: 'draft', featured: false })
    setEditMode('edit')
  }

  const getSeoScore = (post) => {
    if (!post) return { score: 0, checks: [] }
    const title = post.title || '', slug = post.slug || '', excerpt = post.excerpt || '', content = post.content || ''
    const wordCount = content.split(/\s+/).filter(Boolean).length
    const checks = [
      { label: 'Title length (30-70 chars)', pass: title.length >= 30 && title.length <= 70, value: `${title.length} chars` },
      { label: 'Slug is set', pass: slug.length > 0, value: slug || 'missing' },
      { label: 'Excerpt filled in', pass: excerpt.length >= 50, value: excerpt.length ? `${excerpt.length} chars` : 'missing' },
      { label: 'Word count 1000+', pass: wordCount >= 1000, value: `${wordCount} words` },
      { label: 'Has H2 section headers', pass: content.includes('## '), value: content.includes('## ') ? 'yes' : 'missing' },
      { label: 'Has prompt example box', pass: content.includes('[PROMPT]'), value: content.includes('[PROMPT]') ? 'yes' : 'missing' },
      { label: 'Has tip callout', pass: content.includes('> [!TIP]'), value: content.includes('> [!TIP]') ? 'yes' : 'missing' },
      { label: 'Cover image set', pass: !!(post.cover_image), value: post.cover_image ? 'set' : 'missing' },
    ]
    return { score: Math.round((checks.filter(c => c.pass).length / checks.length) * 100), checks, wordCount }
  }

  useEffect(() => {
    if (!editing?.id || !editing?.title) return
    const timer = setTimeout(async () => {
      await supabase.from('blog_posts').update({ ...editing, updated_at: new Date().toISOString() }).eq('id', editing.id)
    }, 30000)
    return () => clearTimeout(timer)
  }, [editing])

  const insertMarkdown = (before, after = '', placeholder = '') => {
    const textarea = document.getElementById('blog-content-editor')
    if (!textarea) return
    const start = textarea.selectionStart, end = textarea.selectionEnd
    const selected = editing.content.substring(start, end) || placeholder
    const newContent = editing.content.substring(0, start) + before + selected + after + editing.content.substring(end)
    setEditing(prev => ({ ...prev, content: newContent }))
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + before.length, start + before.length + selected.length) }, 0)
  }

  const inputStyle = { width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 14px', color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

  if (previewing) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setPreviewing(null)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>← Back</button>
          <button onClick={() => { setEditing(previewing); setPreviewing(null); setEditMode('edit') }} style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: '6px 14px', color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✏️ Edit</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 11, background: previewing.status === 'published' ? `${C.teal}20` : `${C.muted}20`, border: `1px solid ${previewing.status === 'published' ? C.teal + '44' : C.muted + '33'}`, borderRadius: 20, padding: '4px 12px', color: previewing.status === 'published' ? C.teal : C.muted, fontWeight: 600 }}>
            {previewing.status === 'published' ? '● Live' : '○ Draft'}
          </span>
          <button onClick={() => togglePublish(previewing).then(() => setPreviewing(prev => ({ ...prev, status: prev.status === 'published' ? 'draft' : 'published' })))}
            style={{ background: previewing.status === 'published' ? 'none' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: `1px solid ${previewing.status === 'published' ? C.border : 'transparent'}`, borderRadius: 8, padding: '6px 16px', color: previewing.status === 'published' ? C.muted : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {previewing.status === 'published' ? 'Unpublish' : '✦ Publish'}
          </button>
        </div>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', maxHeight: '75vh', overflowY: 'auto' }}>
        {previewing.cover_image && <div style={{ width: '100%', height: 240, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}><img src={previewing.cover_image} alt={previewing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
        {previewing.category && <span style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 600, color: C.accent, display: 'inline-block', marginBottom: 12 }}>{previewing.category}</span>}
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 900, color: C.text, marginBottom: 10 }}>{previewing.title}</h1>
        {previewing.excerpt && <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.8, marginBottom: 24, borderLeft: `3px solid ${C.accent}`, paddingLeft: 16, fontStyle: 'italic' }}>{previewing.excerpt}</p>}
        <div style={{ height: 1, background: C.border, marginBottom: 24 }} />
        <div>{renderMarkdownPreview(previewing.content)}</div>
      </div>
    </div>
  )

  if (editing !== null) {
    const seo = getSeoScore(editing)
    const wordCount = (editing.content || '').split(/\s+/).filter(Boolean).length
    const readTime = Math.max(1, Math.ceil(wordCount / 200))
    const titleLen = (editing.title || '').length
    const slugValid = /^[a-z0-9-]+$/.test(editing.slug || '')
    const TOOLBAR = [
      { label: 'B', before: '**', after: '**', placeholder: 'bold text' },
      { label: 'I', before: '*', after: '*', placeholder: 'italic text' },
      { label: 'H2', before: '\n## ', after: '', placeholder: 'Section heading' },
      { label: 'H3', before: '\n### ', after: '', placeholder: 'Subheading' },
      { label: '`code`', before: '`', after: '`', placeholder: 'code' },
      { label: '— list', before: '\n- ', after: '', placeholder: 'List item' },
      { label: '1. list', before: '\n1. ', after: '', placeholder: 'List item' },
      { label: '> quote', before: '\n> ', after: '', placeholder: 'Quote text' },
      { label: '💡 Tip', before: '\n> [!TIP]\n> ', after: '', placeholder: 'Your tip here' },
      { label: '✦ Prompt', before: '\n[PROMPT]\n', after: '\n[/PROMPT]', placeholder: 'Your example prompt here' },
      { label: '---', before: '\n---\n', after: '', placeholder: '' },
    ]
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { setEditing(null); setEditMode('edit') }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>← Back</button>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text }}>{editing.id ? 'Edit Post' : 'New Post'}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: seo.score >= 80 ? `${C.teal}20` : seo.score >= 50 ? `${C.gold}20` : `${C.red}20`, border: `1px solid ${seo.score >= 80 ? C.teal : seo.score >= 50 ? C.gold : C.red}44`, borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: seo.score >= 80 ? C.teal : seo.score >= 50 ? C.gold : C.red }}>SEO {seo.score}%</div>
            <div style={{ fontSize: 12, color: C.muted, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 12px' }}>{wordCount} words · {readTime} min read</div>
            <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 2 }}>
              {[['edit', '✏️'], ['preview', '👁'], ['split', '⊞']].map(([mode, label]) => (
                <button key={mode} onClick={() => setEditMode(mode)}
                  style={{ background: editMode === mode ? `${C.accent}20` : 'none', border: `1px solid ${editMode === mode ? C.accent + '55' : 'transparent'}`, borderRadius: 6, padding: '5px 10px', color: editMode === mode ? C.accent : C.muted, fontSize: 13, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {editMode !== 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>Title <span style={{ color: titleLen > 70 ? C.red : titleLen >= 30 ? C.teal : C.muted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{titleLen}/60</span></label>
                <input value={editing.title} onChange={e => setEditing(prev => ({ ...prev, title: e.target.value, slug: prev.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }))} style={inputStyle} placeholder="Post title..." />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>Slug <span style={{ color: slugValid && editing.slug ? C.teal : C.red, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{slugValid && editing.slug ? '✓ valid' : '✗ invalid'}</span></label>
                <input value={editing.slug} onChange={e => setEditing(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} style={inputStyle} placeholder="post-url-slug" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Category</label><select value={editing.category} onChange={e => setEditing(prev => ({ ...prev, category: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Author</label><input value={editing.author} onChange={e => setEditing(prev => ({ ...prev, author: e.target.value }))} style={inputStyle} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Cover Image URL</label><input value={editing.cover_image} onChange={e => setEditing(prev => ({ ...prev, cover_image: e.target.value }))} style={inputStyle} placeholder="https://..." /></div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>Excerpt <span style={{ color: (editing.excerpt || '').length >= 120 ? C.teal : C.muted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{(editing.excerpt || '').length}/160</span></label>
              <textarea value={editing.excerpt} onChange={e => setEditing(prev => ({ ...prev, excerpt: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Short description shown in search results..." />
            </div>
          </div>
        )}
        {editMode !== 'preview' && editing.title && (
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px', marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>🔍 Google Preview</div>
            <div style={{ fontSize: 15, color: '#4A90E2', marginBottom: 2 }}>{editing.title.slice(0, 60)}{editing.title.length > 60 ? '...' : ''}</div>
            <div style={{ fontSize: 12, color: C.teal, marginBottom: 4 }}>trydreamscape.com/blog/{editing.slug || 'your-slug-here'}</div>
            <div style={{ fontSize: 13, color: C.muted }}>{(editing.excerpt || 'Add an excerpt...').slice(0, 160)}</div>
          </div>
        )}
        {editMode !== 'preview' && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8, padding: '8px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px 10px 0 0' }}>
            {TOOLBAR.map(tool => (
              <button key={tool.label} onClick={() => insertMarkdown(tool.before, tool.after, tool.placeholder)}
                style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', color: C.text, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {tool.label}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: editMode === 'split' ? 'grid' : 'block', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {editMode !== 'preview' && (
            <textarea id="blog-content-editor" value={editing.content} onChange={e => setEditing(prev => ({ ...prev, content: e.target.value }))} rows={editMode === 'split' ? 22 : 18}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7, fontFamily: 'monospace', fontSize: 13, borderRadius: editMode !== 'split' ? '0 0 10px 10px' : 10 }} placeholder="Write your post content here using markdown..." />
          )}
          {editMode !== 'edit' && (
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', minHeight: 400, maxHeight: editMode === 'split' ? 520 : '70vh', overflowY: 'auto' }}>
              {editing.title && <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 10 }}>{editing.title}</h1>}
              {editing.excerpt && <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 14, borderLeft: `3px solid ${C.accent}`, paddingLeft: 14, fontStyle: 'italic' }}>{editing.excerpt}</p>}
              {renderMarkdownPreview(editing.content)}
            </div>
          )}
        </div>
        {editMode !== 'preview' && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px', marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Publishing Checklist — {seo.score}% ready</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
              {seo.checks.map(check => (
                <div key={check.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ color: check.pass ? C.teal : C.red, flexShrink: 0 }}>{check.pass ? '✓' : '✗'}</span>
                  <span style={{ color: check.pass ? C.text : C.muted }}>{check.label}</span>
                  <span style={{ color: C.muted, fontSize: 10, marginLeft: 'auto' }}>{check.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={() => { setEditing(null); setEditMode('edit') }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 20px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => savePost('draft')} disabled={saving} style={{ background: 'none', border: `1px solid ${C.accent}55`, borderRadius: 10, padding: '10px 20px', color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving...' : '💾 Save Draft'}</button>
          <button onClick={() => savePost('published')} disabled={saving || seo.score < 60} title={seo.score < 60 ? 'Complete the checklist before publishing' : 'Publish'}
            style={{ background: seo.score < 60 ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: seo.score < 60 ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Publishing...' : seo.score < 60 ? '⚠️ Not Ready' : '✦ Publish'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.muted }}>{posts.length} post{posts.length !== 1 ? 's' : ''} · {posts.filter(p => p.status === 'published').length} published · {posts.filter(p => p.status === 'draft').length} drafts</div>
        <button onClick={newPost} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '8px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New Post</button>
      </div>
      {loading ? <Spinner /> : posts.length === 0 ? (
        <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 16, padding: '48px', textAlign: 'center' }}>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 16 }}>No blog posts yet.</p>
          <button onClick={newPost} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New Post</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {posts.map(post => (
            <div key={post.id} style={{ background: C.card, border: `1px solid ${post.status === 'published' ? C.accent + '33' : C.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {post.cover_image ? <img src={post.cover_image} alt={post.title} style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 52, height: 52, borderRadius: 8, background: `${C.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>✦</div>}
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{post.title}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{post.category} · {new Date(post.created_at).toLocaleDateString()}</div>
              </div>
              {post.featured && <span style={{ fontSize: 10, background: `${C.gold}20`, border: `1px solid ${C.gold}44`, borderRadius: 10, padding: '2px 8px', color: C.gold, fontWeight: 700 }}>⭐ Featured</span>}
              <span style={{ fontSize: 11, background: post.status === 'published' ? `${C.teal}20` : `${C.muted}20`, border: `1px solid ${post.status === 'published' ? C.teal + '44' : C.muted + '33'}`, borderRadius: 20, padding: '3px 10px', color: post.status === 'published' ? C.teal : C.muted, fontWeight: 600 }}>{post.status === 'published' ? '● Live' : '○ Draft'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setPreviewing(post)} style={{ background: `${C.teal}18`, border: `1px solid ${C.teal}44`, borderRadius: 8, padding: '5px 12px', color: C.teal, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>👁 Preview</button>
                <button onClick={() => { setEditing(post); setEditMode('split') }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>✏️ Edit</button>
                <button onClick={() => togglePublish(post)} style={{ background: post.status === 'published' ? 'none' : `${C.accent}20`, border: `1px solid ${post.status === 'published' ? C.border : C.accent + '55'}`, borderRadius: 8, padding: '5px 12px', color: post.status === 'published' ? C.muted : C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{post.status === 'published' ? 'Unpublish' : '✦ Publish'}</button>
                <button onClick={() => toggleFeatured(post)} style={{ background: post.featured ? `${C.gold}20` : 'none', border: `1px solid ${post.featured ? C.gold + '55' : C.border}`, borderRadius: 8, padding: '5px 12px', color: post.featured ? C.gold : C.muted, fontSize: 12, cursor: 'pointer' }}>⭐</button>
                <button onClick={() => setConfirm(post.id)} style={{ background: `${C.red}18`, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '5px 12px', color: C.red, fontSize: 12, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(8,11,20,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🗑️</div>
            <h3 style={{ color: C.text, marginBottom: 8, fontFamily: 'Playfair Display, serif' }}>Delete this post?</h3>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deletePost(confirm)} style={{ flex: 1, background: `linear-gradient(135deg, ${C.red}, #CC0000)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bug Reports Tab ───────────────────────────────────────────
function BugReportsTab() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('open')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [adminNote, setAdminNote] = useState('')
  const [saving, setSaving] = useState(false)

  const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'dismissed']
  const CATEGORY_OPTIONS = ['all', 'bug', 'ui', 'generation', 'payment', 'suggestion', 'other']

  const STATUS_CONFIG = {
    open:        { label: '🔴 Open',        color: C.red },
    in_progress: { label: '🟡 In Progress', color: C.gold },
    resolved:    { label: '🟢 Resolved',    color: C.teal },
    dismissed:   { label: '⚫ Dismissed',   color: C.muted },
  }

  const CAT_LABELS = {
    bug: '🐛 Bug', ui: '🎨 UI Issue', generation: '🎭 Generation',
    payment: '💳 Payment', suggestion: '💡 Suggestion', other: '📋 Other',
  }

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('bug_reports')
      .select('*, profiles(username, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(200)
    setReports(data || [])
    setLoading(false)
  }

  const updateStatus = async (id, status) => {
    setSaving(true)
    await supabase.from('bug_reports').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    if (selected?.id === id) setSelected(prev => ({ ...prev, status }))
    setSaving(false)
  }

  const saveNote = async () => {
    if (!selected) return
    setSaving(true)
    await supabase.from('bug_reports').update({ admin_notes: adminNote, updated_at: new Date().toISOString() }).eq('id', selected.id)
    setReports(prev => prev.map(r => r.id === selected.id ? { ...r, admin_notes: adminNote } : r))
    setSelected(prev => ({ ...prev, admin_notes: adminNote }))
    setSaving(false)
  }

  const openReport = (r) => {
    setSelected(r)
    setAdminNote(r.admin_notes || '')
  }

  const filtered = reports.filter(r => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    const matchCat = categoryFilter === 'all' || r.category === categoryFilter
    return matchStatus && matchCat
  })

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = reports.filter(r => r.status === s).length
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {/* Left — list */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {STATUS_OPTIONS.map(s => (
            <div key={s} onClick={() => setStatusFilter(s === statusFilter ? 'all' : s)}
              style={{ background: statusFilter === s ? `${STATUS_CONFIG[s].color}20` : C.card, border: `1px solid ${statusFilter === s ? STATUS_CONFIG[s].color + '55' : C.border}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: STATUS_CONFIG[s].color, fontFamily: 'Playfair Display, serif' }}>{counts[s] || 0}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{STATUS_CONFIG[s].label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {CATEGORY_OPTIONS.map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              style={{ background: categoryFilter === c ? `${C.accent}20` : 'none', border: `1px solid ${categoryFilter === c ? C.accent + '55' : C.border}`, borderRadius: 8, padding: '5px 12px', color: categoryFilter === c ? C.accent : C.muted, fontSize: 11, fontWeight: categoryFilter === c ? 700 : 400, cursor: 'pointer' }}>
              {c === 'all' ? 'All' : CAT_LABELS[c]}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 12, color: C.muted, alignSelf: 'center' }}>{filtered.length} reports</div>
        </div>

        {loading ? <Spinner /> : filtered.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <p style={{ color: C.muted, fontSize: 14 }}>No reports in this filter.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(r => {
              const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.open
              const isSelected = selected?.id === r.id
              return (
                <div key={r.id} onClick={() => openReport(r)}
                  style={{ background: isSelected ? `${C.accent}12` : C.card, border: `1px solid ${isSelected ? C.accent + '55' : C.border}`, borderRadius: 12, padding: '12px 16px', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {/* Category + status */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, background: `${C.accent}18`, border: `1px solid ${C.accent}33`, borderRadius: 6, padding: '2px 8px', color: C.accent, fontWeight: 600 }}>{CAT_LABELS[r.category] || r.category}</span>
                      <span style={{ fontSize: 10, background: `${sc.color}18`, border: `1px solid ${sc.color}33`, borderRadius: 6, padding: '2px 8px', color: sc.color, fontWeight: 600 }}>{sc.label}</span>
                    </div>
                    {/* User */}
                    <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>@{r.profiles?.username || 'anonymous'}</span>
                    {/* Time */}
                    <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto', flexShrink: 0 }}>
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {/* Description preview */}
                  <div style={{ fontSize: 13, color: C.text, marginTop: 6, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {r.description}
                  </div>
                  {/* Page */}
                  {r.page_url && <div style={{ fontSize: 11, color: C.accent, marginTop: 4 }}>{r.page_url}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Right — detail panel */}
      {selected && (
        <div style={{ width: 340, flexShrink: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px', alignSelf: 'flex-start', position: 'sticky', top: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Report Detail</div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>

          {/* Category + status badges */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, background: `${C.accent}18`, border: `1px solid ${C.accent}33`, borderRadius: 6, padding: '3px 10px', color: C.accent, fontWeight: 600 }}>{CAT_LABELS[selected.category] || selected.category}</span>
            <span style={{ fontSize: 11, background: `${STATUS_CONFIG[selected.status]?.color}18`, border: `1px solid ${STATUS_CONFIG[selected.status]?.color}33`, borderRadius: 6, padding: '3px 10px', color: STATUS_CONFIG[selected.status]?.color, fontWeight: 600 }}>{STATUS_CONFIG[selected.status]?.label}</span>
          </div>

          {/* User info */}
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
            <div style={{ color: C.muted, marginBottom: 2 }}>Submitted by</div>
            <div style={{ color: C.text, fontWeight: 600 }}>@{selected.profiles?.username || 'anonymous'}</div>
            <div style={{ color: C.muted, marginTop: 4 }}>{new Date(selected.created_at).toLocaleString()}</div>
            {selected.page_url && <div style={{ color: C.accent, marginTop: 4 }}>{selected.page_url}</div>}
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Description</div>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.description}</div>
          </div>

          {/* User agent */}
          {selected.user_agent && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Browser</div>
              <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5, wordBreak: 'break-all' }}>{selected.user_agent.slice(0, 120)}</div>
            </div>
          )}

          {/* Change status */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Update Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STATUS_OPTIONS.map(s => (
                <button key={s} onClick={() => updateStatus(selected.id, s)} disabled={selected.status === s || saving}
                  style={{ background: selected.status === s ? `${STATUS_CONFIG[s].color}20` : 'none', border: `1px solid ${selected.status === s ? STATUS_CONFIG[s].color + '55' : C.border}`, borderRadius: 8, padding: '7px 12px', color: selected.status === s ? STATUS_CONFIG[s].color : C.muted, fontSize: 12, fontWeight: selected.status === s ? 700 : 400, cursor: selected.status === s ? 'default' : 'pointer', textAlign: 'left' }}>
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Admin notes */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Admin Notes</div>
            <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={3} placeholder="Internal notes — not shown to user..."
              style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.6 }} />
            <button onClick={saveNote} disabled={saving}
              style={{ width: '100%', background: saving ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '9px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', marginTop: 8 }}>
              {saving ? 'Saving...' : '💾 Save Notes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Admin Dashboard ───────────────────────────────────────────
export default function Admin({ user, profile }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    if (profile && !profile.is_admin) navigate('/')
  }, [profile])

  if (!profile?.is_admin) return null

  const tabs = [
    ['overview',      '📊 Overview'],
    ['users',         '👥 Users'],
    ['orders',        '📦 Orders'],
    ['content',       '🎨 Content'],
    ['compliance',    '🛡️ Compliance'],
    ['stats',         '📈 Gen Stats'],
    ['announcements', '📢 Announcements'],
    ['blog',          '✍️ Blog'],
    ['bugs',          '🐛 Bug Reports'],
  ]

  return (
    <div style={{ padding: '40px 20px', maxWidth: 1060, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Admin Dashboard</div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: C.text, marginBottom: 4 }}>Dreamscape Control Center</h1>
        <p style={{ color: C.muted, fontSize: 13 }}>Founder access · @{profile?.username}</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: 28, overflowX: 'auto', flexWrap: 'nowrap' }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === id ? C.accent : 'transparent'}`, padding: '10px 16px', color: tab === id ? C.accent : C.muted, fontSize: 13, fontWeight: tab === id ? 700 : 400, cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview'      && <OverviewTab />}
      {tab === 'users'         && <UsersTab />}
      {tab === 'orders'        && <OrdersTab />}
      {tab === 'content'       && <ContentTab />}
      {tab === 'compliance'    && <ComplianceTab />}
      {tab === 'stats'         && <StatsTab />}
      {tab === 'announcements' && <AnnouncementsTab />}
      {tab === 'blog'          && <BlogTab />}
      {tab === 'bugs'          && <BugReportsTab />}
    </div>
  )
}
