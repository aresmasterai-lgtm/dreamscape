import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
}

const CATEGORY_COLORS = {
  'Prompting Guides': C.accent,
  'Dream AI Tips & Tricks': C.teal,
  'Artist Spotlights': C.gold,
  'Merch & Product Guides': '#FF6B9D',
  'Platform Updates & News': '#00B4D8',
}

function Spinner() {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '80px 0' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
      {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
    </div>
  )
}

export default function BlogPost() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => { loadPost() }, [slug])

  const loadPost = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()

    if (!data) { setLoading(false); return }
    setPost(data)

    // Load related posts
    const { data: rel } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, category, cover_image, published_at')
      .eq('status', 'published')
      .eq('category', data.category)
      .neq('slug', slug)
      .limit(3)
    setRelated(rel || [])
    setLoading(false)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <Spinner />

  if (!post) return (
    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
      <p style={{ color: C.muted, fontSize: 16, marginBottom: 20 }}>Post not found.</p>
      <button onClick={() => navigate('/blog')} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>← Back to Blog</button>
    </div>
  )

  const catColor = CATEGORY_COLORS[post.category] || C.muted

  return (
    <div style={{ padding: '40px 20px', maxWidth: 760, margin: '0 auto' }}>
      {/* Back */}
      <button onClick={() => navigate('/blog')}
        style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 12, cursor: 'pointer', marginBottom: 32 }}>
        ← Back to Blog
      </button>

      {/* Cover image */}
      {post.cover_image && (
        <div style={{ width: '100%', height: 360, borderRadius: 16, overflow: 'hidden', marginBottom: 36, background: `linear-gradient(135deg, ${C.accent}30, ${C.teal}20)` }}>
          <img src={post.cover_image} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      {/* Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {post.category && (
          <span style={{ background: catColor + '20', border: `1px solid ${catColor}44`, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 600, color: catColor }}>{post.category}</span>
        )}
        <span style={{ fontSize: 12, color: C.muted }}>
          {new Date(post.published_at || post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
        <span style={{ fontSize: 12, color: C.muted }}>· {post.author || 'Dreamscape Team'}</span>
      </div>

      {/* Title */}
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px, 5vw, 40px)', fontWeight: 900, color: C.text, marginBottom: 16, lineHeight: 1.2 }}>{post.title}</h1>

      {/* Excerpt */}
      {post.excerpt && (
        <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.8, marginBottom: 32, borderLeft: `3px solid ${C.accent}`, paddingLeft: 20, fontStyle: 'italic' }}>{post.excerpt}</p>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: C.border, marginBottom: 36 }} />

      {/* Content */}
      <div style={{ color: C.text, fontSize: 15, lineHeight: 1.9 }}
        dangerouslySetInnerHTML={{ __html: post.content?.replace(/\n\n/g, '</p><p style="margin-bottom:20px">').replace(/\n/g, '<br/>').replace(/^/, '<p style="margin-bottom:20px">').replace(/$/, '</p>') || '' }}
      />

      {/* Share */}
      <div style={{ height: 1, background: C.border, margin: '40px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, color: C.muted }}>Written by <span style={{ color: C.text, fontWeight: 600 }}>{post.author || 'Dreamscape Team'}</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleShare}
            style={{ background: copied ? `${C.teal}20` : 'none', border: `1px solid ${copied ? C.teal + '55' : C.border}`, borderRadius: 8, padding: '7px 16px', color: copied ? C.teal : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {copied ? '✅ Copied!' : '🔗 Share'}
          </button>
          <button onClick={() => navigate('/create')}
            style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '7px 16px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Try Dream AI ✦
          </button>
        </div>
      </div>

      {/* Related posts */}
      {related.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 20 }}>Related Posts</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {related.map(rel => (
              <div key={rel.id} onClick={() => navigate(`/blog/${rel.slug}`)}
                style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '55'}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <div style={{ height: 120, background: `linear-gradient(135deg, ${C.accent}20, ${C.teal}15)`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {rel.cover_image ? <img src={rel.cover_image} alt={rel.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 32, opacity: 0.4 }}>✦</span>}
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.4, marginBottom: 6 }}>{rel.title}</div>
                  <div style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>Read more →</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
