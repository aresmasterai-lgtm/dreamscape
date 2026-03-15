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

// ── Tier Change Modal ─────────────────────────────────────────
function TierModal({ confirm, TIERS, TIER_BENEFITS, updating, onUpdate, onClose }) {
  const [selectedTier, setSelectedTier] = useState(confirm.currentTier)
  const tierInfo = TIER_BENEFITS[selectedTier]
  const isUpgrade = TIERS.indexOf(selectedTier) > TIERS.indexOf(confirm.currentTier)
  const changed = selectedTier !== confirm.currentTier

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(8,11,20,0.92)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '32px', maxWidth: 460, width: '100%' }}>
        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 4 }}>Change Plan</h3>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>Updating subscription for <strong style={{ color: C.text }}>@{confirm.username}</strong></p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {TIERS.map(t => {
            const info = TIER_BENEFITS[t]
            const isCurrent = t === confirm.currentTier
            const isSelected = t === selectedTier
            return (
              <button key={t} onClick={() => setSelectedTier(t)}
                style={{ background: isSelected ? info.color + '20' : C.panel, border: `2px solid ${isSelected ? info.color : C.border}`, borderRadius: 12, padding: '14px 18px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: isSelected ? info.color : C.text }}>✦ {info.label}</span>
                    {isCurrent && <span style={{ fontSize: 10, background: C.border, borderRadius: 6, padding: '1px 7px', color: C.muted }}>Current</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? info.color : C.muted }}>{info.price}</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {info.gens} generations/mo · {info.products} products · {info.commission} commission
                </div>
              </button>
            )
          })}
        </div>

        {changed && (
          <div style={{ background: isUpgrade ? `${C.teal}12` : `${C.gold}12`, border: `1px solid ${isUpgrade ? C.teal + '44' : C.gold + '44'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: isUpgrade ? C.teal : C.gold, marginBottom: 4 }}>
              {isUpgrade ? '⬆ Upgrade' : '⬇ Downgrade'} · {TIER_BENEFITS[confirm.currentTier].label} → {tierInfo.label}
            </div>
            <div style={{ color: C.muted, fontSize: 12 }}>
              {isUpgrade
                ? `${tierInfo.label} privileges apply immediately — ${tierInfo.gens} gens/mo, ${tierInfo.products} products, ${tierInfo.commission} commission.`
                : `Access reduced to ${tierInfo.gens} gens/mo, ${tierInfo.products} products. Takes effect immediately.`
              }
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => changed && onUpdate(confirm.userId, selectedTier)} disabled={!changed || updating === confirm.userId}
            style={{ flex: 2, background: !changed ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13, fontWeight: 700, cursor: !changed ? 'not-allowed' : 'pointer' }}>
            {updating === confirm.userId ? 'Saving...' : !changed ? 'Select a plan' : `Apply ${tierInfo.label} Plan ✦`}
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
  const [updating, setUpdating] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [success, setSuccess] = useState(null) // { userId, message }

  const TIER_BENEFITS = {
    free:    { label: 'Free',    color: C.muted,   gens: 10,   products: 3,  commission: '30%', price: '$0' },
    starter: { label: 'Starter', color: C.teal,    gens: 50,   products: 15, commission: '25%', price: '$9.99/mo' },
    pro:     { label: 'Pro',     color: C.accent,  gens: 200,  products: 50, commission: '20%', price: '$24.99/mo' },
    studio:  { label: 'Studio',  color: C.gold,    gens: '∞',  products: '∞',commission: '15%', price: '$59.99/mo' },
  }

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
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        subscription_status: tier === 'free' ? 'inactive' : 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscription_tier: tier, subscription_status: tier === 'free' ? 'inactive' : 'active' } : u))
      const username = users.find(u => u.id === userId)?.username
      setSuccess({ userId, message: `@${username} upgraded to ${TIER_BENEFITS[tier].label} ✓` })
      setTimeout(() => setSuccess(null), 4000)
    }
    setUpdating(null)
    setConfirm(null)
  }

  const toggleSuspend = async (userId, suspended) => {
    setUpdating(userId)
    await supabase.from('profiles').update({ is_suspended: !suspended }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: !suspended } : u))
    setUpdating(null)
    setConfirm(null)
  }

  const toggleAdmin = async (userId, isAdmin) => {
    setUpdating(userId)
    await supabase.from('profiles').update({ is_admin: !isAdmin }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !isAdmin } : u))
    setUpdating(null)
    setConfirm(null)
  }

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      {/* Success banner */}
      {success && (
        <div style={{ background: `${C.teal}18`, border: `1px solid ${C.teal}44`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: C.teal, display: 'flex', alignItems: 'center', gap: 8 }}>
          ✅ {success.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
          style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 14px', color: C.text, fontSize: 13, outline: 'none', width: 260 }} />
        <div style={{ fontSize: 12, color: C.muted }}>{filtered.length} user{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(u => {
            const tier = u.subscription_tier || 'free'
            const tierInfo = TIER_BENEFITS[tier] || TIER_BENEFITS.free
            return (
              <div key={u.id} style={{ background: C.card, border: `1px solid ${u.is_suspended ? '#FF4D4D44' : C.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', transition: 'border-color 0.2s' }}>

                {/* Avatar */}
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${tierInfo.color}, ${tierInfo.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {u.username?.[0]?.toUpperCase() || '?'}
                </div>

                {/* User info */}
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {u.display_name || u.username}
                    {u.is_admin && <span style={{ fontSize: 10, background: C.gold + '22', border: `1px solid ${C.gold}44`, borderRadius: 10, padding: '2px 8px', color: C.gold }}>⚡ ADMIN</span>}
                    {u.is_suspended && <span style={{ fontSize: 10, background: '#FF4D4D22', border: '1px solid #FF4D4D44', borderRadius: 10, padding: '2px 8px', color: '#FF4D4D' }}>🚫 SUSPENDED</span>}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>@{u.username} · Joined {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  <div style={{ fontSize: 11, color: tierInfo.color, marginTop: 2, fontWeight: 600 }}>
                    {tierInfo.label} · {tierInfo.gens} gens/mo · {tierInfo.products} products · {tierInfo.commission} commission
                  </div>
                </div>

                {/* Tier badge */}
                <span style={{ background: tierInfo.color + '20', border: `1px solid ${tierInfo.color}44`, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: tierInfo.color, whiteSpace: 'nowrap' }}>
                  ✦ {tierInfo.label}
                </span>

                {/* Change tier button */}
                <button
                  onClick={() => setConfirm({ type: 'tier', userId: u.id, username: u.username, currentTier: tier })}
                  disabled={updating === u.id}
                  style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: '6px 14px', color: C.accent, fontSize: 12, fontWeight: 600, cursor: updating === u.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                  {updating === u.id ? 'Saving...' : '⭐ Change Plan'}
                </button>

                {/* Suspend */}
                {!u.is_admin && (
                  <button onClick={() => setConfirm({ type: 'suspend', userId: u.id, username: u.username, suspended: u.is_suspended })}
                    disabled={updating === u.id}
                    style={{ background: u.is_suspended ? `${C.teal}20` : '#FF4D4D18', border: `1px solid ${u.is_suspended ? C.teal + '44' : '#FF4D4D44'}`, borderRadius: 8, padding: '6px 14px', color: u.is_suspended ? C.teal : '#FF4D4D', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {u.is_suspended ? 'Unsuspend' : 'Suspend'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tier Change Modal ── */}
      {confirm?.type === 'tier' && (
        <TierModal
          confirm={confirm}
          TIERS={TIERS}
          TIER_BENEFITS={TIER_BENEFITS}
          updating={updating}
          onUpdate={updateTier}
          onClose={() => setConfirm(null)}
        />
      )}

      {/* ── Suspend Confirm ── */}
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

// ── Blog Tab ──────────────────────────────────────────────────
function renderMarkdownPreview(content) {
  if (!content) return []
  const lines = content.split('\n')
  const elements = []
  let i = 0
  let k = 0
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
    if (imgMatch) {
      elements.push(<img key={key()} src={imgMatch[2]} alt={imgMatch[1]} style={{ width: '100%', borderRadius: 10, marginBottom: 16 }} />)
      i++; continue
    }
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
    if (paraLines.length) {
      const text = paraLines.join(' ')
      elements.push(<p key={key()} style={{ fontSize: 14, color: C.text, lineHeight: 1.8, marginBottom: 16 }}>{text}</p>)
    }
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
  const [editMode, setEditMode] = useState('edit') // 'edit' | 'preview' | 'split'

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
    if (editing.id) {
      await supabase.from('blog_posts').update(updates).eq('id', editing.id)
    } else {
      await supabase.from('blog_posts').insert(updates)
    }
    setSaving(false)
    setEditing(null)
    setEditMode('edit')
    loadPosts()
  }

  const newPost = () => {
    setEditing({ title: '', slug: '', excerpt: '', content: '', category: CATEGORIES[0], cover_image: '', author: 'Dream AI', status: 'draft', featured: false })
    setEditMode('edit')
  }

  const inputStyle = { width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 14px', color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

  // ── SEO Analysis ──────────────────────────────────────────────
  const getSeoScore = (post) => {
    if (!post) return { score: 0, checks: [] }
    const title = post.title || ''
    const slug = post.slug || ''
    const excerpt = post.excerpt || ''
    const content = post.content || ''
    const wordCount = content.split(/\s+/).filter(Boolean).length
    const hasH2 = content.includes('## ')
    const hasPromptBox = content.includes('[PROMPT]')
    const hasTip = content.includes('> [!TIP]')

    const checks = [
      { label: 'Title length (50-60 chars)', pass: title.length >= 30 && title.length <= 70, value: `${title.length} chars` },
      { label: 'Slug is set', pass: slug.length > 0, value: slug || 'missing' },
      { label: 'Excerpt filled in', pass: excerpt.length >= 50, value: excerpt.length ? `${excerpt.length} chars` : 'missing' },
      { label: 'Word count 1000+', pass: wordCount >= 1000, value: `${wordCount} words` },
      { label: 'Has H2 section headers', pass: hasH2, value: hasH2 ? 'yes' : 'missing' },
      { label: 'Has prompt example box', pass: hasPromptBox, value: hasPromptBox ? 'yes' : 'missing' },
      { label: 'Has tip callout', pass: hasTip, value: hasTip ? 'yes' : 'missing' },
      { label: 'Cover image set', pass: !!(post.cover_image), value: post.cover_image ? 'set' : 'missing' },
    ]
    const score = Math.round((checks.filter(c => c.pass).length / checks.length) * 100)
    return { score, checks, wordCount, readTime: Math.max(1, Math.ceil(wordCount / 200)) }
  }

  // ── Auto-save ─────────────────────────────────────────────────
  useEffect(() => {
    if (!editing?.id || !editing?.title) return
    const timer = setTimeout(async () => {
      await supabase.from('blog_posts').update({ ...editing, updated_at: new Date().toISOString() }).eq('id', editing.id)
    }, 30000) // auto-save after 30s of inactivity
    return () => clearTimeout(timer)
  }, [editing])

  // ── Markdown toolbar insert ───────────────────────────────────
  const insertMarkdown = (before, after = '', placeholder = '') => {
    const textarea = document.getElementById('blog-content-editor')
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = editing.content.substring(start, end) || placeholder
    const newContent = editing.content.substring(0, start) + before + selected + after + editing.content.substring(end)
    setEditing(prev => ({ ...prev, content: newContent }))
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + before.length, start + before.length + selected.length) }, 0)
  }

  // ── Preview Modal ─────────────────────────────────────────────
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

      {/* Preview panel */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', maxHeight: '75vh', overflowY: 'auto' }}>
        {previewing.cover_image && (
          <div style={{ width: '100%', height: 240, borderRadius: 12, overflow: 'hidden', marginBottom: 24, background: `linear-gradient(135deg, ${C.accent}30, ${C.teal}20)` }}>
            <img src={previewing.cover_image} alt={previewing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        {previewing.category && <span style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 600, color: C.accent, display: 'inline-block', marginBottom: 12 }}>{previewing.category}</span>}
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 900, color: C.text, marginBottom: 10, lineHeight: 1.2 }}>{previewing.title}</h1>
        {previewing.excerpt && <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.8, marginBottom: 24, borderLeft: `3px solid ${C.accent}`, paddingLeft: 16, fontStyle: 'italic' }}>{previewing.excerpt}</p>}
        <div style={{ height: 1, background: C.border, marginBottom: 24 }} />
        <div>{renderMarkdownPreview(previewing.content)}</div>
      </div>
    </div>
  )

  // ── Edit View ─────────────────────────────────────────────────
  if (editing !== null) {
    const seo = getSeoScore(editing)
    const wordCount = (editing.content || '').split(/\s+/).filter(Boolean).length
    const readTime = Math.max(1, Math.ceil(wordCount / 200))
    const titleLen = (editing.title || '').length
    const slugValid = /^[a-z0-9-]+$/.test(editing.slug || '')

    const TOOLBAR = [
      { label: 'B', title: 'Bold', before: '**', after: '**', placeholder: 'bold text' },
      { label: 'I', title: 'Italic', before: '*', after: '*', placeholder: 'italic text' },
      { label: 'H2', title: 'Heading', before: '\n## ', after: '', placeholder: 'Section heading' },
      { label: 'H3', title: 'Subheading', before: '\n### ', after: '', placeholder: 'Subheading' },
      { label: '`code`', title: 'Inline code', before: '`', after: '`', placeholder: 'code' },
      { label: '— list', title: 'List item', before: '\n- ', after: '', placeholder: 'List item' },
      { label: '1. list', title: 'Numbered list', before: '\n1. ', after: '', placeholder: 'List item' },
      { label: '> quote', title: 'Blockquote', before: '\n> ', after: '', placeholder: 'Quote text' },
      { label: '💡 Tip', title: 'Tip callout', before: '\n> [!TIP]\n> ', after: '', placeholder: 'Your tip here' },
      { label: '✦ Prompt', title: 'Prompt box', before: '\n[PROMPT]\n', after: '\n[/PROMPT]', placeholder: 'Your example prompt here' },
      { label: '---', title: 'Divider', before: '\n---\n', after: '', placeholder: '' },
    ]

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { setEditing(null); setEditMode('edit') }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>← Back</button>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text }}>{editing.id ? 'Edit Post' : 'New Post'}</h2>
            {editing.id && <span style={{ fontSize: 10, color: C.muted, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 8px' }}>Auto-saves every 30s</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* SEO Score badge */}
            <div style={{ background: seo.score >= 80 ? `${C.teal}20` : seo.score >= 50 ? `${C.gold}20` : `${C.red}20`, border: `1px solid ${seo.score >= 80 ? C.teal : seo.score >= 50 ? C.gold : C.red}44`, borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: seo.score >= 80 ? C.teal : seo.score >= 50 ? C.gold : C.red }}>
              SEO {seo.score}%
            </div>
            {/* Word count */}
            <div style={{ fontSize: 12, color: C.muted, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 12px' }}>
              {wordCount} words · {readTime} min read
            </div>
            {/* Edit / Preview / Split */}
            <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 2 }}>
              {[['edit', '✏️'], ['preview', '👁'], ['split', '⊞']].map(([mode, label]) => (
                <button key={mode} onClick={() => setEditMode(mode)} title={mode}
                  style={{ background: editMode === mode ? `${C.accent}20` : 'none', border: `1px solid ${editMode === mode ? C.accent + '55' : 'transparent'}`, borderRadius: 6, padding: '5px 10px', color: editMode === mode ? C.accent : C.muted, fontSize: 13, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fields */}
        {editMode !== 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  Title
                  <span style={{ color: titleLen > 70 ? C.red : titleLen >= 30 ? C.teal : C.muted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{titleLen}/60</span>
                </label>
                <input value={editing.title} onChange={e => setEditing(prev => ({ ...prev, title: e.target.value, slug: prev.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }))} style={{ ...inputStyle, borderColor: titleLen > 70 ? C.red + '88' : C.border }} placeholder="Post title..." />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  Slug
                  <span style={{ color: slugValid && editing.slug ? C.teal : C.red, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{slugValid && editing.slug ? '✓ valid' : '✗ invalid'}</span>
                </label>
                <input value={editing.slug} onChange={e => setEditing(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} style={{ ...inputStyle, borderColor: !slugValid && editing.slug ? C.red + '88' : C.border }} placeholder="post-url-slug" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Category</label>
                <select value={editing.category} onChange={e => setEditing(prev => ({ ...prev, category: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Author</label>
                <input value={editing.author} onChange={e => setEditing(prev => ({ ...prev, author: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Cover Image URL</label>
                <input value={editing.cover_image} onChange={e => setEditing(prev => ({ ...prev, cover_image: e.target.value }))} style={inputStyle} placeholder="https://..." />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                Excerpt (meta description)
                <span style={{ color: (editing.excerpt || '').length >= 120 && (editing.excerpt || '').length <= 160 ? C.teal : C.muted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{(editing.excerpt || '').length}/160</span>
              </label>
              <textarea value={editing.excerpt} onChange={e => setEditing(prev => ({ ...prev, excerpt: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Short description shown in search results and post cards (120-160 chars ideal)..." />
            </div>
          </div>
        )}

        {/* Google search preview */}
        {editMode !== 'preview' && editing.title && (
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px', marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>🔍 Google Preview</div>
            <div style={{ fontSize: 15, color: '#4A90E2', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{editing.title.slice(0, 60)}{editing.title.length > 60 ? '...' : ''}</div>
            <div style={{ fontSize: 12, color: C.teal, marginBottom: 4 }}>trydreamscape.com/blog/{editing.slug || 'your-slug-here'}</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{(editing.excerpt || 'Add an excerpt to show here...').slice(0, 160)}</div>
          </div>
        )}

        {/* Markdown toolbar */}
        {editMode !== 'preview' && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8, padding: '8px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px 10px 0 0' }}>
            {TOOLBAR.map(tool => (
              <button key={tool.label} onClick={() => insertMarkdown(tool.before, tool.after, tool.placeholder)} title={tool.title}
                style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', color: C.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: tool.label === '`code`' ? 'monospace' : 'inherit' }}>
                {tool.label}
              </button>
            ))}
          </div>
        )}

        {/* Content area */}
        <div style={{ display: editMode === 'split' ? 'grid' : 'block', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {editMode !== 'preview' && (
            <textarea id="blog-content-editor" value={editing.content} onChange={e => setEditing(prev => ({ ...prev, content: e.target.value }))}
              rows={editMode === 'split' ? 22 : 18}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7, fontFamily: 'monospace', fontSize: 13, borderRadius: editMode !== 'split' ? '0 0 10px 10px' : 10 }}
              placeholder="Write your post content here using markdown..." />
          )}
          {editMode !== 'edit' && (
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', minHeight: 400, maxHeight: editMode === 'split' ? 520 : '70vh', overflowY: 'auto' }}>
              {editing.title && <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 10 }}>{editing.title}</h1>}
              {editing.excerpt && <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 14, borderLeft: `3px solid ${C.accent}`, paddingLeft: 14, fontStyle: 'italic' }}>{editing.excerpt}</p>}
              {editing.excerpt && <div style={{ height: 1, background: C.border, marginBottom: 14 }} />}
              {renderMarkdownPreview(editing.content)}
              {!editing.content && <p style={{ color: C.muted, fontSize: 13 }}>Start writing to see preview...</p>}
            </div>
          )}
        </div>

        {/* SEO Checklist */}
        {editMode !== 'preview' && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px', marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Publishing Checklist — {seo.score}% ready
              <span style={{ display: 'inline-block', marginLeft: 10, width: 100, height: 4, background: C.border, borderRadius: 2, verticalAlign: 'middle', position: 'relative', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${seo.score}%`, background: seo.score >= 80 ? C.teal : seo.score >= 50 ? C.gold : C.red, borderRadius: 2 }} />
              </span>
            </div>
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

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={() => { setEditing(null); setEditMode('edit') }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 20px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => savePost('draft')} disabled={saving}
            style={{ background: 'none', border: `1px solid ${C.accent}55`, borderRadius: 10, padding: '10px 20px', color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Saving...' : '💾 Save Draft'}
          </button>
          <button onClick={() => savePost('published')} disabled={saving || seo.score < 60}
            title={seo.score < 60 ? 'Complete the checklist before publishing' : 'Publish'}
            style={{ background: seo.score < 60 ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: seo.score < 60 ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Publishing...' : seo.score < 60 ? '⚠️ Not Ready' : '✦ Publish'}
          </button>
        </div>
      </div>
    )
  }

  // ── Posts List ────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.muted }}>{posts.length} post{posts.length !== 1 ? 's' : ''} · {posts.filter(p => p.status === 'published').length} published · {posts.filter(p => p.status === 'draft').length} drafts</div>
        <button onClick={newPost} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '8px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New Post</button>
      </div>

      {loading ? <Spinner /> : posts.length === 0 ? (
        <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 16, padding: '48px', textAlign: 'center' }}>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 16 }}>No blog posts yet. Create your first one or let Ares draft one!</p>
          <button onClick={newPost} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New Post</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {posts.map(post => (
            <div key={post.id} style={{ background: C.card, border: `1px solid ${post.status === 'published' ? C.accent + '33' : C.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {post.cover_image
                ? <img src={post.cover_image} style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 52, height: 52, borderRadius: 8, background: `${C.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>✦</div>
              }
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{post.title}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{post.category} · {new Date(post.created_at).toLocaleDateString()}</div>
              </div>
              {post.featured && <span style={{ fontSize: 10, background: `${C.gold}20`, border: `1px solid ${C.gold}44`, borderRadius: 10, padding: '2px 8px', color: C.gold, fontWeight: 700 }}>⭐ Featured</span>}
              <span style={{ fontSize: 11, background: post.status === 'published' ? `${C.teal}20` : `${C.muted}20`, border: `1px solid ${post.status === 'published' ? C.teal + '44' : C.muted + '33'}`, borderRadius: 20, padding: '3px 10px', color: post.status === 'published' ? C.teal : C.muted, fontWeight: 600 }}>
                {post.status === 'published' ? '● Live' : '○ Draft'}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setPreviewing(post)} style={{ background: `${C.teal}18`, border: `1px solid ${C.teal}44`, borderRadius: 8, padding: '5px 12px', color: C.teal, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>👁 Preview</button>
                <button onClick={() => { setEditing(post); setEditMode('split') }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>✏️ Edit</button>
                <button onClick={() => togglePublish(post)} style={{ background: post.status === 'published' ? 'none' : `${C.accent}20`, border: `1px solid ${post.status === 'published' ? C.border : C.accent + '55'}`, borderRadius: 8, padding: '5px 12px', color: post.status === 'published' ? C.muted : C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {post.status === 'published' ? 'Unpublish' : '✦ Publish'}
                </button>
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


// ── DevTools Tab ──────────────────────────────────────────────
function DevToolsTab() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all | new | investigating | resolved
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [stats, setStats] = useState(null)

  useEffect(() => { loadLogs() }, [filter, typeFilter])

  const loadLogs = async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('error_logs')
        .select('*, profiles(username)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (filter !== 'all') q = q.eq('status', filter)
      if (typeFilter !== 'all') q = q.eq('type', typeFilter)
      const { data } = await q
      setLogs(data || [])

      // Stats
      const [
        { count: total },
        { count: newCount },
        { count: investigating },
      ] = await Promise.all([
        supabase.from('error_logs').select('id', { count: 'exact', head: true }),
        supabase.from('error_logs').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('error_logs').select('id', { count: 'exact', head: true }).eq('status', 'investigating'),
      ])
      setStats({ total: total || 0, new: newCount || 0, investigating: investigating || 0 })
    } catch {}
    setLoading(false)
  }

  const updateStatus = async (id, status) => {
    await supabase.from('error_logs').update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null }).eq('id', id)
    setLogs(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    if (selected?.id === id) setSelected(prev => ({ ...prev, status }))
  }

  const deleteLog = async (id) => {
    await supabase.from('error_logs').delete().eq('id', id)
    setLogs(prev => prev.filter(l => l.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const clearResolved = async () => {
    await supabase.from('error_logs').delete().eq('status', 'resolved')
    setLogs(prev => prev.filter(l => l.status !== 'resolved'))
  }

  const STATUS_COLORS = {
    new: C.red,
    investigating: C.gold,
    resolved: C.teal,
    ignored: C.muted,
  }

  const TYPE_COLORS = {
    react_crash: C.red,
    uncaught_error: '#FF6B35',
    unhandled_rejection: C.gold,
    api_error: C.accent,
  }

  const TYPE_LABELS = {
    react_crash: '💥 React Crash',
    uncaught_error: '⚠️ JS Error',
    unhandled_rejection: '🔴 Promise Rejection',
    api_error: '🌐 API Error',
  }

  const filtered = logs.filter(l =>
    !search ||
    l.message?.toLowerCase().includes(search.toLowerCase()) ||
    l.page?.toLowerCase().includes(search.toLowerCase()) ||
    l.profiles?.username?.toLowerCase().includes(search.toLowerCase())
  )

  const uniqueTypes = [...new Set(logs.map(l => l.type))]

  return (
    <div style={{ display: 'flex', gap: 16, height: '70vh', minHeight: 500 }}>
      {/* Left panel — log list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              ['Total Errors', stats.total, C.muted],
              ['New', stats.new, C.red],
              ['Investigating', stats.investigating, C.gold],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Playfair Display, serif', color }}>{val}</div>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search errors, pages, users..."
            style={{ flex: 1, minWidth: 160, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 12px', color: C.text, fontSize: 12, outline: 'none' }} />
          <button onClick={clearResolved} style={{ background: `${C.teal}18`, border: `1px solid ${C.teal}33`, borderRadius: 8, padding: '7px 12px', color: C.teal, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear Resolved</button>
          <button onClick={loadLogs} style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}33`, borderRadius: 8, padding: '7px 12px', color: C.accent, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>↻ Refresh</button>
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {['all', 'new', 'investigating', 'resolved', 'ignored'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ background: filter === s ? `${STATUS_COLORS[s] || C.accent}20` : 'none', border: `1px solid ${filter === s ? (STATUS_COLORS[s] || C.accent) + '55' : C.border}`, borderRadius: 20, padding: '3px 12px', color: filter === s ? (STATUS_COLORS[s] || C.accent) : C.muted, fontSize: 11, fontWeight: filter === s ? 700 : 400, cursor: 'pointer' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setTypeFilter('all')}
            style={{ background: typeFilter === 'all' ? `${C.accent}20` : 'none', border: `1px solid ${typeFilter === 'all' ? C.accent + '55' : C.border}`, borderRadius: 20, padding: '3px 12px', color: typeFilter === 'all' ? C.accent : C.muted, fontSize: 11, cursor: 'pointer' }}>
            All Types
          </button>
          {uniqueTypes.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              style={{ background: typeFilter === t ? `${TYPE_COLORS[t] || C.muted}20` : 'none', border: `1px solid ${typeFilter === t ? (TYPE_COLORS[t] || C.muted) + '55' : C.border}`, borderRadius: 20, padding: '3px 12px', color: typeFilter === t ? (TYPE_COLORS[t] || C.muted) : C.muted, fontSize: 11, cursor: 'pointer' }}>
              {TYPE_LABELS[t] || t}
            </button>
          ))}
        </div>

        {/* Log list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading ? <Spinner /> : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted, fontSize: 14 }}>
              {logs.length === 0 ? '✅ No errors logged — all clear!' : 'No errors match your filters'}
            </div>
          ) : filtered.map(log => (
            <div key={log.id} onClick={() => setSelected(log)}
              style={{ background: selected?.id === log.id ? `${C.accent}15` : C.card, border: `1px solid ${selected?.id === log.id ? C.accent + '55' : log.status === 'new' ? C.red + '33' : C.border}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (selected?.id !== log.id) e.currentTarget.style.borderColor = C.accent + '44' }}
              onMouseLeave={e => { if (selected?.id !== log.id) e.currentTarget.style.borderColor = log.status === 'new' ? C.red + '33' : C.border }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, background: (STATUS_COLORS[log.status] || C.muted) + '20', border: `1px solid ${(STATUS_COLORS[log.status] || C.muted)}44`, borderRadius: 10, padding: '1px 7px', color: STATUS_COLORS[log.status] || C.muted, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>
                  {log.status}
                </span>
                <span style={{ fontSize: 10, color: TYPE_COLORS[log.type] || C.muted, fontWeight: 600 }}>{TYPE_LABELS[log.type] || log.type}</span>
                <span style={{ fontSize: 10, color: C.muted, marginLeft: 'auto', flexShrink: 0 }}>
                  {new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ fontSize: 12, color: C.text, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {log.message || 'No message'}
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: C.muted }}>
                <span>📍 {log.page || '/'}</span>
                {log.profiles?.username && <span>👤 @{log.profiles.username}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — error detail */}
      {selected ? (
        <div style={{ width: 340, flexShrink: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Error Detail</h3>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>

          {/* Type + Status */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, background: (TYPE_COLORS[selected.type] || C.muted) + '20', border: `1px solid ${(TYPE_COLORS[selected.type] || C.muted)}44`, borderRadius: 20, padding: '3px 10px', color: TYPE_COLORS[selected.type] || C.muted, fontWeight: 700 }}>
              {TYPE_LABELS[selected.type] || selected.type}
            </span>
            <span style={{ fontSize: 11, background: (STATUS_COLORS[selected.status] || C.muted) + '20', border: `1px solid ${(STATUS_COLORS[selected.status] || C.muted)}44`, borderRadius: 20, padding: '3px 10px', color: STATUS_COLORS[selected.status] || C.muted, fontWeight: 700 }}>
              {selected.status}
            </span>
          </div>

          {/* Message */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Message</div>
            <div style={{ background: C.bg, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: C.red, fontFamily: 'monospace', lineHeight: 1.6, wordBreak: 'break-word' }}>
              {selected.message || 'No message'}
            </div>
          </div>

          {/* Page + User */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted }}>Page</span>
              <span style={{ color: C.accent, fontWeight: 600 }}>{selected.page || '/'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted }}>User</span>
              <span style={{ color: C.text }}>
                {selected.profiles?.username ? `@${selected.profiles.username}` : selected.user_id ? 'Logged in' : 'Anonymous'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted }}>Time</span>
              <span style={{ color: C.text }}>{new Date(selected.created_at).toLocaleString()}</span>
            </div>
          </div>

          {/* Stack trace */}
          {selected.stack && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Stack Trace</div>
              <div style={{ background: C.bg, borderRadius: 8, padding: '10px 12px', fontSize: 10, color: C.muted, fontFamily: 'monospace', lineHeight: 1.7, maxHeight: 180, overflowY: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                {selected.stack}
              </div>
            </div>
          )}

          {/* Metadata */}
          {selected.metadata && Object.keys(selected.metadata).length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Metadata</div>
              <div style={{ background: C.bg, borderRadius: 8, padding: '10px 12px', fontSize: 10, color: C.muted, fontFamily: 'monospace', lineHeight: 1.7, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(selected.metadata, null, 2)}
              </div>
            </div>
          )}

          {/* Status actions */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Update Status</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {['new', 'investigating', 'resolved', 'ignored'].map(s => (
                <button key={s} onClick={() => updateStatus(selected.id, s)}
                  disabled={selected.status === s}
                  style={{ background: selected.status === s ? (STATUS_COLORS[s] || C.muted) + '30' : 'none', border: `1px solid ${(STATUS_COLORS[s] || C.muted)}${selected.status === s ? '88' : '44'}`, borderRadius: 8, padding: '7px', color: STATUS_COLORS[s] || C.muted, fontSize: 11, fontWeight: selected.status === s ? 700 : 400, cursor: selected.status === s ? 'default' : 'pointer', textTransform: 'capitalize' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => deleteLog(selected.id)}
            style={{ background: `${C.red}15`, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '8px', color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🗑 Delete Log
          </button>
        </div>
      ) : (
        <div style={{ width: 340, flexShrink: 0, background: C.card, border: `1px dashed ${C.border}`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: C.muted }}>
          <span style={{ fontSize: 32 }}>🔍</span>
          <span style={{ fontSize: 13 }}>Click an error to inspect it</span>
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

  const tabs = [['users', '👥 Users'], ['orders', '📦 Orders'], ['content', '🎨 Content'], ['blog', '✍️ Blog'], ['devtools', '🛠 DevTools']]

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
      {tab === 'blog' && <BlogTab />}
      {tab === 'devtools' && <DevToolsTab />}
    </div>
  )
}
