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

export default function CreateProductModal({ user, imageUrl, artworkId, title: defaultTitle, onClose, onSuccess }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [hostedImageUrl, setHostedImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [catalog, setCatalog] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState(defaultTitle || '')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('35.00')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

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

  const handleCreate = async () => {
    if (!title.trim()) return setError('Product title is required.')
    if (!hostedImageUrl) return setError('No image URL available.')
    if (!selected) return setError('Please select a product type.')
    setError(''); setCreating(true)
    try {
      const variantIds = selected.variants?.slice(0, 3).map(v => v.id) || []
      const res = await fetch('/api/printful?action=create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, variantIds, imageUrl: hostedImageUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error) || JSON.stringify(data) || 'Printful error')
      const printfulId = data.id || data.sync_product?.id || ''
      await supabase.from('products').insert({
        user_id: user.id,
        artwork_id: artworkId || null,
        title,
        description,
        product_type: selected.type,
        price: parseFloat(price),
        printful_product_id: String(printfulId),
        printful_variant_ids: variantIds.map(String),
        mockup_url: hostedImageUrl,
      })
      setStep(4)
    } catch (e) {
      setError(e.message)
    }
    setCreating(false)
  }

  const [variantLoading, setVariantLoading] = useState(false)

  const selectProduct = async (p) => {
    setSelected(p)
    if (!p.variants || p.variants.length === 0) {
      setVariantLoading(true)
      try {
        const res = await fetch(`/api/printful?action=catalogProduct&id=${p.id}`)
        const data = await res.json()
        const variants = data.variants || []
        setSelected({ ...p, variants })
      } catch {}
      setVariantLoading(false)
    }
  }
    !search || p.model.toLowerCase().includes(search.toLowerCase()) || p.type.toLowerCase().includes(search.toLowerCase())
  )

  const stepLabel = { 1: 'Preparing Image...', 2: 'Choose Product Type', 3: 'Product Details', 4: 'Product Created!' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(8,11,20,0.97)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, maxWidth: 640, width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text, marginBottom: 8 }}>{stepLabel[step]}</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1,2,3].map(s => (
                <div key={s} style={{ width: 28, height: 3, borderRadius: 2, background: s < step || step === 4 ? C.teal : s === step ? C.accent : C.border, transition: 'all 0.3s' }} />
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '50%', width: 32, height: 32, color: C.muted, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* Step 1: Uploading */}
          {step === 1 && (
            <div style={{ padding: 48, textAlign: 'center' }}>
              {error ? (
                <div style={{ color: '#ff6b6b', fontSize: 14 }}>{error}</div>
              ) : (
                <>
                  <Spinner />
                  <p style={{ color: C.muted, fontSize: 14, marginTop: 8 }}>Uploading your image to our servers...</p>
                </>
              )}
            </div>
          )}

          {/* Step 2: Pick product type */}
          {step === 2 && (
            <div style={{ padding: '20px 24px' }}>
              {hostedImageUrl && (
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', marginBottom: 18 }}>
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
            <div style={{ padding: '20px 24px' }}>
              {selected && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', marginBottom: 20 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                    {selected.image ? <img src={selected.image} alt={selected.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>🎨</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>{selected.model}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{selected.type}</div>
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
              <div style={{ marginBottom: 24 }}>
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

          {/* Step 4: Success */}
          {step === 4 && (
            <div style={{ padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${C.teal}20`, border: `2px solid ${C.teal}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 20px' }}>✅</div>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 8 }}>Product Created!</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>Your product is now live in the Dreamscape marketplace. Printful will generate mockup images shortly.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => { onSuccess(); navigate('/marketplace') }}
                  style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '12px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>View in Marketplace ✦</button>
                <button onClick={onSuccess}
                  style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 24px', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Done</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 2 || step === 3) && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
            <button onClick={step === 2 ? onClose : () => { setStep(2); setError('') }}
              style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.muted, fontSize: 13, cursor: 'pointer' }}>
              {step === 2 ? 'Cancel' : '← Back'}
            </button>
            {step === 2 && (
              <button onClick={() => { if (!selected) return setError('Please select a product type.'); setError(''); setStep(3) }}
                disabled={variantLoading}
                style={{ flex: 2, background: selected && !variantLoading ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : C.border, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: selected && !variantLoading ? 'pointer' : 'not-allowed' }}>
                {variantLoading ? '⏳ Loading variants...' : 'Next: Product Details →'}
              </button>
            )}
            {step === 3 && (
              <button onClick={handleCreate} disabled={creating}
                style={{ flex: 2, background: creating ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer' }}>
                {creating ? '⏳ Creating...' : 'Create Product ✦'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
