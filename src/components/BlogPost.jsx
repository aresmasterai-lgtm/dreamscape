import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  const wordCount = (post.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
  const readTime = Math.max(1, Math.ceil(wordCount / 200))

  return (
    <div style={{ padding: '40px 20px', maxWidth: 780, margin: '0 auto' }}>

      {/* Global blog styles injected once */}
      <style>{`
        .ds-blog-content {
          color: ${C.text};
          font-size: 16px;
          line-height: 1.9;
          font-family: 'DM Sans', sans-serif;
        }
        .ds-blog-content h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(24px, 4vw, 38px);
          font-weight: 900;
          color: ${C.text};
          margin: 40px 0 16px;
          line-height: 1.15;
        }
        .ds-blog-content h2 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(20px, 3vw, 28px);
          font-weight: 900;
          color: ${C.text};
          margin: 48px 0 14px;
          line-height: 1.25;
          padding-bottom: 10px;
          border-bottom: 1px solid ${C.border};
        }
        .ds-blog-content h3 {
          font-size: 20px;
          font-weight: 700;
          color: ${C.text};
          margin: 32px 0 10px;
        }
        .ds-blog-content p {
          margin-bottom: 22px;
          color: ${C.text};
        }
        .ds-blog-content a {
          color: ${C.accent};
          text-decoration: underline;
        }
        .ds-blog-content strong {
          font-weight: 700;
          color: ${C.text};
        }
        .ds-blog-content em {
          font-style: italic;
          color: ${C.muted};
        }
        .ds-blog-content code {
          background: ${C.bg};
          border: 1px solid ${C.border};
          border-radius: 5px;
          padding: 2px 7px;
          font-family: monospace;
          font-size: 14px;
          color: ${C.teal};
        }
        .ds-blog-content pre {
          background: ${C.bg};
          border: 1px solid ${C.border};
          border-radius: 12px;
          padding: 20px 24px;
          margin: 24px 0;
          overflow-x: auto;
          font-family: monospace;
          font-size: 13px;
          color: ${C.teal};
          line-height: 1.7;
        }
        .ds-blog-content blockquote {
          border-left: 4px solid ${C.accent};
          margin: 28px 0;
          padding: 16px 24px;
          background: ${C.accent}10;
          border-radius: 0 12px 12px 0;
          font-style: italic;
          color: ${C.muted};
          font-size: 17px;
          line-height: 1.8;
        }
        .ds-blog-content ul {
          padding-left: 0;
          list-style: none;
          margin: 16px 0 24px;
        }
        .ds-blog-content ul li {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
          font-size: 15px;
          line-height: 1.7;
        }
        .ds-blog-content ul li::before {
          content: '✦';
          color: ${C.accent};
          flex-shrink: 0;
          margin-top: 3px;
          font-size: 12px;
        }
        .ds-blog-content ol {
          padding-left: 0;
          list-style: none;
          counter-reset: list-counter;
          margin: 16px 0 24px;
        }
        .ds-blog-content ol li {
          counter-increment: list-counter;
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
          font-size: 15px;
          line-height: 1.7;
        }
        .ds-blog-content ol li::before {
          content: counter(list-counter);
          background: ${C.accent}22;
          border: 1px solid ${C.accent}44;
          border-radius: 50%;
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: ${C.accent};
          flex-shrink: 0;
          margin-top: 1px;
        }
        .ds-blog-content hr {
          border: none;
          border-top: 1px solid ${C.border};
          margin: 36px 0;
        }
        /* Featured image — full width with caption */
        .ds-blog-content .ds-image {
          margin: 36px 0;
          border-radius: 16px;
          overflow: hidden;
        }
        .ds-blog-content .ds-image img {
          width: 100%;
          display: block;
          border-radius: 16px;
        }
        .ds-blog-content .ds-image figcaption {
          text-align: center;
          font-size: 12px;
          color: ${C.muted};
          margin-top: 10px;
          font-style: italic;
        }
        /* Side by side images */
        .ds-blog-content .ds-image-pair {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 36px 0;
        }
        .ds-blog-content .ds-image-pair img {
          width: 100%;
          border-radius: 12px;
          display: block;
        }
        /* Prompt box */
        .ds-blog-content .ds-prompt {
          background: ${C.accent}12;
          border: 1px solid ${C.accent}44;
          border-radius: 14px;
          padding: 20px 24px;
          margin: 28px 0;
        }
        .ds-blog-content .ds-prompt-label {
          font-size: 10px;
          font-weight: 700;
          color: ${C.accent};
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .ds-blog-content .ds-prompt p {
          font-family: monospace;
          font-size: 14px;
          color: ${C.text};
          line-height: 1.8;
          margin: 0;
        }
        /* Tip callout */
        .ds-blog-content .ds-tip {
          background: ${C.teal}12;
          border: 1px solid ${C.teal}44;
          border-left: 4px solid ${C.teal};
          border-radius: 0 12px 12px 0;
          padding: 16px 20px;
          margin: 28px 0;
        }
        .ds-blog-content .ds-tip-label {
          font-size: 10px;
          font-weight: 700;
          color: ${C.teal};
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .ds-blog-content .ds-tip p {
          font-size: 14px;
          color: ${C.text};
          line-height: 1.7;
          margin: 0;
        }
        /* Warning callout */
        .ds-blog-content .ds-warning {
          background: ${C.gold}12;
          border: 1px solid ${C.gold}44;
          border-left: 4px solid ${C.gold};
          border-radius: 0 12px 12px 0;
          padding: 16px 20px;
          margin: 28px 0;
        }
        .ds-blog-content .ds-warning-label {
          font-size: 10px;
          font-weight: 700;
          color: ${C.gold};
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .ds-blog-content .ds-warning p {
          font-size: 14px;
          color: ${C.text};
          line-height: 1.7;
          margin: 0;
        }
        /* Stat / highlight box */
        .ds-blog-content .ds-stat {
          background: linear-gradient(135deg, ${C.accent}18, ${C.teal}12);
          border: 1px solid ${C.accent}33;
          border-radius: 16px;
          padding: 28px 32px;
          margin: 32px 0;
          text-align: center;
        }
        .ds-blog-content .ds-stat-number {
          font-family: 'Playfair Display', serif;
          font-size: 48px;
          font-weight: 900;
          color: ${C.accent};
          line-height: 1;
          margin-bottom: 8px;
        }
        .ds-blog-content .ds-stat-label {
          font-size: 14px;
          color: ${C.muted};
        }
        @media (max-width: 600px) {
          .ds-blog-content .ds-image-pair { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Back */}
      <button onClick={() => navigate('/blog')}
        style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 12, cursor: 'pointer', marginBottom: 32 }}>
        ← Back to Blog
      </button>

      {/* Cover image */}
      {post.cover_image && (
        <div style={{ width: '100%', height: 400, borderRadius: 20, overflow: 'hidden', marginBottom: 36, background: `linear-gradient(135deg, ${C.accent}30, ${C.teal}20)` }}>
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
        <span style={{ fontSize: 12, color: C.muted }}>· {readTime} min read</span>
        <span style={{ fontSize: 12, color: C.muted }}>· {post.author || 'Dreamscape Team'}</span>
      </div>

      {/* Title */}
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 5vw, 46px)', fontWeight: 900, color: C.text, marginBottom: 16, lineHeight: 1.15 }}>{post.title}</h1>

      {/* Excerpt */}
      {post.excerpt && (
        <p style={{ fontSize: 18, color: C.muted, lineHeight: 1.8, marginBottom: 36, borderLeft: `3px solid ${C.accent}`, paddingLeft: 20, fontStyle: 'italic' }}>{post.excerpt}</p>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: C.border, marginBottom: 44 }} />

      {/* Rich HTML content */}
      <div
        className="ds-blog-content"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {/* CTA box */}
      <div style={{ background: `linear-gradient(135deg, ${C.accent}18, ${C.teal}12)`, border: `1px solid ${C.accent}33`, borderRadius: 20, padding: '36px 40px', margin: '48px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>✦</div>
        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, color: C.text, marginBottom: 10 }}>Ready to create?</h3>
        <p style={{ color: C.muted, fontSize: 15, marginBottom: 24, lineHeight: 1.7 }}>Try Dream AI and generate your first artwork in seconds. No experience needed.</p>
        <a href="/create" style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 12, padding: '14px 32px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>Start Creating Free ✦</a>
      </div>

      {/* Share + author */}
      <div style={{ height: 1, background: C.border, margin: '32px 0' }} />
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
        <div style={{ marginTop: 56 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: C.text, marginBottom: 24 }}>Related Posts</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {related.map(rel => (
              <div key={rel.id} onClick={() => navigate(`/blog/${rel.slug}`)}
                style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '55'}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <div style={{ height: 130, background: `linear-gradient(135deg, ${C.accent}20, ${C.teal}15)`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {rel.cover_image ? <img src={rel.cover_image} alt={rel.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 32, opacity: 0.4 }}>✦</span>}
                </div>
                <div style={{ padding: '14px 16px' }}>
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
