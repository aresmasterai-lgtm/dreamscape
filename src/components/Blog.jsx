import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
}

const CATEGORIES = ['All', 'Prompting Guides', 'Dream AI Tips & Tricks', 'Artist Spotlights', 'Merch & Product Guides', 'Platform Updates & News']

const CATEGORY_COLORS = {
  'Prompting Guides': C.accent,
  'Dream AI Tips & Tricks': C.teal,
  'Artist Spotlights': C.gold,
  'Merch & Product Guides': '#FF6B9D',
  'Platform Updates & News': '#00B4D8',
}

function timeAgo(ts) {
  const date = new Date(ts)
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function CategoryBadge({ category }) {
  const color = CATEGORY_COLORS[category] || C.muted
  return (
    <span style={{ background: color + '20', border: `1px solid ${color}44`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, color, whiteSpace: 'nowrap' }}>
      {category}
    </span>
  )
}

function PostCard({ post, featured }) {
  const navigate = useNavigate()
  return (
    <div onClick={() => navigate(`/blog/${post.slug}`)}
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: featured ? 20 : 14, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s, transform 0.2s', display: featured ? 'grid' : 'block', gridTemplateColumns: featured ? '1fr 1fr' : '1fr' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent + '55'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)' }}>
      {/* Cover image */}
      <div style={{ height: featured ? '100%' : 180, minHeight: featured ? 280 : 180, background: `linear-gradient(135deg, ${C.accent}30, ${C.teal}20)`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {post.cover_image
          ? <img src={post.cover_image} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 64, opacity: 0.4 }}>✦</span>}
        {featured && (
          <div style={{ position: 'absolute', top: 14, left: 14, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 700, color: '#fff' }}>✦ Featured</div>
        )}
      </div>
      {/* Content */}
      <div style={{ padding: featured ? '32px' : '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {post.category && <CategoryBadge category={post.category} />}
          <span style={{ fontSize: 11, color: C.muted }}>{timeAgo(post.published_at || post.created_at)}</span>
        </div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: featured ? 26 : 17, fontWeight: 900, color: C.text, marginBottom: 10, lineHeight: 1.3 }}>{post.title}</h2>
        {post.excerpt && <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>{post.excerpt}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.muted }}>
          <span>✦</span>
          <span>{post.author || 'Dreamscape Team'}</span>
          <span>·</span>
          <span style={{ color: C.accent, fontWeight: 600 }}>Read more →</span>
        </div>
      </div>
    </div>
  )
}

export default function Blog() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => { loadPosts() }, [])

  const loadPosts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }

  const filtered = posts.filter(p => {
    const matchCat = category === 'All' || p.category === category
    const matchSearch = !search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.excerpt?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const featured = filtered.find(p => p.featured)
  const rest = filtered.filter(p => !p.featured)

  return (
    <div style={{ padding: '48px 20px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>The Dreamscape Blog</div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, color: C.text, marginBottom: 16, lineHeight: 1.1 }}>Tips, Guides & Inspiration</h1>
        <p style={{ color: C.muted, fontSize: 15, maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>Master AI art creation, learn prompting techniques, and grow your creative business.</p>
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts..."
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 14px', color: C.text, fontSize: 13, outline: 'none', width: 220 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              style={{ background: category === cat ? `${C.accent}20` : 'none', border: `1px solid ${category === cat ? C.accent + '55' : C.border}`, borderRadius: 20, padding: '5px 14px', color: category === cat ? C.accent : C.muted, fontSize: 12, fontWeight: category === cat ? 700 : 400, cursor: 'pointer' }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '60px 0' }}>
          <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
          {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '64px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
          <p style={{ color: C.muted, fontSize: 14 }}>No posts found. Check back soon!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {featured && <PostCard post={featured} featured={true} />}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {rest.map(post => <PostCard key={post.id} post={post} featured={false} />)}
          </div>
        </div>
      )}
    </div>
  )
}
