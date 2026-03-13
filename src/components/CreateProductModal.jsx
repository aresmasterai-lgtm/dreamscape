import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
}

function Spinner() {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '40px 0' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
      {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
    </div>
  )
}

const STEPS = ['Upload', 'Product Type', 'Details', 'Share', 'Done']

export default function CreateProductModal({ user, imageUrl, artworkId, title: defaultTitle, onClose, onSuccess }) {
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [hostedImageUrl, setHostedImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  const [catalog, setCatalog] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [variantLoading, setVariantLoading] = useState(false)
  const [search, setSearch] = useState('')

  const [title, setTitle] = useState(defaultTitle || '')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('35.00')
  const [tags, setTags] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const [createdProductId, setCreatedProductId] = useState(null)
  const [createdMockupUrl, setCreatedMockupUrl] = useState('')
  const [channels, setChannels] = useState([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [caption, setCaption] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')

  useEffect(() => {
    loadCatalog()
    if (imageUrl?.startsWith('data:')) {
      uploadDataUrl(imageUrl)
    } else {
      setHostedImageUrl(imageUrl || '')
      setStep(2)
    }
  }, [])

  const uploadDataUrl = async (dataUrl) => {
    setStep(1); setUploading(true)
    try {
      const [header, data] = dataUrl.split(',')
      const mime = header.match(/:(.*?);/)[1]
      const ext = mime.split('/')[1] || 'png'
      const byteStr = atob(data)
      const bytes = new Uint8Array(byteStr.length)
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i)
      const blob = new Blob([bytes], { type: mime })
      const path = `${user.id}/${Date.now()}.${ext}`
      const { data: up, error: upErr } = await supabase.storage.from('artwork').upload(path, blob, { contentType: mime })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('artwork').getPublicUrl(up.path)
      setHostedImageUrl(publicUrl)
      setStep(2)
    } catch (e) {
      setError('Image upload failed: ' + e.message)
      setStep(2)
    }
    setUploading(false)
  }

  const loadCatalog = async () => {
    setCatalogLoading(true)
    try {
      const res = await fetch('/api/printful?action=catalog&offset=0')
      const data = await res.json()
      setCatalog(data.products || [])
    } catch {}
    setCatalogLoading(false)
  }

  const selectProduct = async (p) => {
    setSelected(p)
    if (!p.variants || p.variants.length === 0) {
      setVariantLoading(true)
      try {
        const res = await fetch(`/api/printful?action=catalogProduct&id=${p.id}`)
        const data = await res.json()
        setSelected({ ...p, variants: data.variants || [] })
      } catch {}
      setVariantLoading(false)
    }
  }

  const filtered = catalog.filter(p =>
    !search || p.model?.toLowerCase().includes(search.toLowerCase()) || p.type?.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!title.trim()) return setError('Product title is required.')
    if (!hostedImageUrl) return setError('No image URL available.')
    if (!selected) return setError('Please select a product type.')
    setError(''); setCreating(true)
    try {
      const allVariantIds = (selected.variants || []).map(v => v.id)
      const res = await fetch('/api/printful?action=create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, variantIds: allVariantIds, imageUrl: hostedImageUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error) || JSON.stringify(data) || 'Printful error')

      const printfulId = data.id || data.sync_product?.id || ''
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)

      const { data: inserted } = await supabase.from('products').insert({
        user_id: user.id,
        artwork_id: artworkId || null,
        title,
        description,
        product_type: selected.type,
        price: parseFloat(price),
        printful_product_id: String(printfulId),
        printful_variant_ids: allVariantIds.map(String),
        mockup_url: hostedImageUrl,
        tags: tagList,
      }).select().single()

      setCreatedProductId(inserted?.id || null)
      setCreatedMockupUrl(inserted?.mockup_url || hostedImageUrl)

      setChannelsLoading(true)
      const { data: chData } = await supabase.from('channels').select('*').eq('is_live', true).order('member_count', { ascending: false })
      setChannels(chData || [])
      setChannelsLoading(false)

      setStep(4)
    } catch (e) {
      setError(e.message)
    }
    setCreating(false)
  }

  const handleShare = async () => {
    if (!selectedChannel) return setShareError('Pick a channel to share to.')
    setSharing(true); setShareError('')
    try {
      const { error: postErr } = await supabase.from('channel_posts').insert({
        channel_id: selectedChannel.id,
        user_id: user.id,
        content: caption.trim() || `Check out my new product: ${title}`,
        image_url: createdMockupUrl || '',
        product_id: createdProductId,
        like_count: 0,
        reply_count: 0,
      })
      if (postErr) throw postErr
      setStep(5)
    } catch (e) {
      setShareError(e.message)
    }
    setSharing(false)
  }

  const progressPct = step === 1 ? 0 : step === 2 ? 25 : step === 3 ? 50 : step === 4 ? 75 : 100

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && step < 4 && onClose()}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.text, margin: 0 }}>
              {step === 4 ? '🎉 Share Your Product' : step === 5 ? '✦ All Done!' : 'Create a Product'}
            </h3>
            {step < 4 && (
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}>✕</button>
            )}
          </div>
          <div style={{ height: 3, background: C.border, borderRadius: 3, marginBottom: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.teal})`, borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            {STEPS.slice(0, -1).map((s, i) => (
              <span key={s} style={{ fontSize: 10, color: step > i + 1 ? C.teal : step === i + 1 ? C.accent : C.muted, fontWeight: step === i + 1 ? 700 : 400 }}>{s}</span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* Step 1: Uploading */}
          {step === 1 && (
            <div style={{ padding: '20px 24px' }}>
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '32px', textAlign: 'center' }}>
                <Spinner />
                <p style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>Uploading your artwork to Dreamscape...</p>
              </div>
            </div>
          )}

          {/* Step 2: Pick product type */}
          {step === 2 && (
            <div style={{ padding: '0 24px 20px' }}>
              {hostedImageUrl && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: `${C.teal}10`, border: `1px solid ${C.teal}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                  <img src={hostedImageUrl} alt="Artwork" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}` }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 2 }}>Your artwork is ready</div>
                    <div style={{ fontSize: 11, color: C.muted }}>Select a product to print it on</div>
                  </div>
                </div>
              )}
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search t-shirts, hoodies, mugs..."
                style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14 }} />
              {catalogLoading ? <Spinner /> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                  {filtered.slice(0, 60).map(p => (
                    <div key={p.id} onClick={() => selectProduct(p)}
                      style={{ background: selected?.id === p.id ? `${C.accent}20` : C.bg, border: `1px solid ${selected?.id === p.id ? C.accent : C.border}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { if (selected?.id !== p.id) e.currentTarget.style.borderColor = C.accent + '55' }}
                      onMouseLeave={e => { if (selected?.id !== p.id) e.currentTarget.style.borderColor = C.border }}>
                      <div style={{ height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {p.image ? <img src={p.image} alt={p.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 30 }}>🎨</span>}
                      </div>
                      <div style={{ padding: '7px 9px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: selected?.id === p.id ? C.accent : C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.model}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{p.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div style={{ padding: '0 24px 20px' }}>
              {selected && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                    {selected.image ? <img src={selected.image} alt={selected.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>🎨</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>{selected.model}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{selected.type} · {selected.variants?.length || 0} sizes/colors — all offered automatically</div>
                  </div>
                  <button onClick={() => { setStep(2); setError('') }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 10px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>Change</button>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Product Title</label>
                <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder={`e.g. My Dreamscape ${selected?.model || ''}`}
                  style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Description <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your product..." rows={2}
                  style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Tags <span style={{ fontWeight: 400, textTransform: 'none' }}>(comma-separated)</span></label>
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. surreal, neon, abstract, fantasy"
                  style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                <p style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>Tags help buyers discover your product in search.</p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Retail Price (USD)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }}>$</span>
                  <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="10" step="0.01"
                    style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px 10px 26px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
                <p style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>You keep the difference after Printful's base cost + Stripe fees (~2.9% + $0.30).</p>
              </div>

              {error && <div style={{ background: '#ff6b6b18', border: '1px solid #ff6b6b44', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#ff6b6b' }}>{error}</div>}
            </div>
          )}

          {/* Step 4: Share to Channel */}
          {step === 4 && (
            <div style={{ padding: '0 24px 24px' }}>
              <div style={{ background: C.bg, border: `1px solid ${C.teal}44`, borderRadius: 14, padding: '14px', marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center' }}>
                {createdMockupUrl && (
                  <img src={createdMockupUrl} alt="Product" style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', border: `1px solid ${C.border}`, flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontSize: 11, color: C.teal, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>✦ Product Created</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{selected?.model} · ${parseFloat(price).toFixed(2)}</div>
                </div>
              </div>

              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>Share to a Channel</div>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                Let the community discover your new product. Pick a channel and add an optional caption.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Caption <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <textarea value={caption} onChange={e => setCaption(e.target.value)}
                  placeholder={`Just dropped: ${title} — available now in the marketplace!`}
                  rows={2}
                  style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }} />
              </div>

              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Choose Channel</label>
              {channelsLoading ? <Spinner /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {channels.map(ch => (
                    <div key={ch.id} onClick={() => setSelectedChannel(ch)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: selectedChannel?.id === ch.id ? `${C.accent}18` : C.bg,
                        border: `1px solid ${selectedChannel?.id === ch.id ? C.accent : C.border}`,
                        borderRadius: 12, padding: '12px 16px', cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (selectedChannel?.id !== ch.id) e.currentTarget.style.borderColor = C.accent + '44' }}
                      onMouseLeave={e => { if (selectedChannel?.id !== ch.id) e.currentTarget.style.borderColor = C.border }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: ch.color + '25', border: `1px solid ${ch.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{ch.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: selectedChannel?.id === ch.id ? C.accent : C.text }}>#{ch.display_name}</div>
                        <div style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.description}</div>
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{ch.member_count?.toLocaleString()}</div>
                      {selectedChannel?.id === ch.id && (
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 10, color: '#fff' }}>✓</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {shareError && <div style={{ background: '#ff6b6b18', border: '1px solid #ff6b6b44', borderRadius: 8, padding: '10px 14px', marginTop: 14, fontSize: 13, color: '#ff6b6b' }}>{shareError}</div>}
            </div>
          )}

          {/* Step 5: All done */}
          {step === 5 && (
            <div style={{ padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${C.teal}20`, border: `2px solid ${C.teal}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 20px' }}>✦</div>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 8 }}>You're live!</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
                Your product is in the marketplace{selectedChannel ? <> and your post is in <strong style={{ color: C.accent }}>#{selectedChannel.display_name}</strong></> : ''}. Printful will generate mockup images shortly.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {selectedChannel && (
                  <button onClick={() => { onSuccess(); navigate(`/channels/${selectedChannel.name}`) }}
                    style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '12px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    View in Channel ✦
                  </button>
                )}
                <button onClick={() => { onSuccess(); navigate('/marketplace') }}
                  style={{ background: selectedChannel ? 'none' : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: selectedChannel ? `1px solid ${C.border}` : 'none', borderRadius: 10, padding: '12px 24px', color: selectedChannel ? C.muted : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  View in Marketplace
                </button>
                <button onClick={onSuccess}
                  style={{ background: 'none', border: 'none', padding: '12px 16px', color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 2 || step === 3 || step === 4) && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
            {step === 2 && (
              <>
                <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button
                  onClick={() => { if (!selected) return setError('Please select a product type.'); setError(''); setStep(3) }}
                  disabled={variantLoading || !selected}
                  style={{ flex: 2, background: selected && !variantLoading ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : C.border, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: selected && !variantLoading ? 'pointer' : 'not-allowed' }}>
                  {variantLoading ? '⏳ Loading...' : 'Next: Details →'}
                </button>
              </>
            )}
            {step === 3 && (
              <>
                <button onClick={() => { setStep(2); setError('') }} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>← Back</button>
                <button onClick={handleCreate} disabled={creating}
                  style={{ flex: 2, background: creating ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer' }}>
                  {creating ? '⏳ Creating...' : 'Create Product ✦'}
                </button>
              </>
            )}
            {step === 4 && (
              <>
                <button onClick={() => setStep(5)} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Skip</button>
                <button onClick={handleShare} disabled={sharing || !selectedChannel}
                  style={{ flex: 2, background: sharing || !selectedChannel ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: sharing || !selectedChannel ? 'not-allowed' : 'pointer' }}>
                  {sharing ? '⏳ Posting...' : 'Post to Channel ✦'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
