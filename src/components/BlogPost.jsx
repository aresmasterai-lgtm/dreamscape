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

// ── Markdown Renderer ─────────────────────────────────────────
function renderMarkdown(content) {
  if (!content) return []

  const lines = content.split('\n')
  const elements = []
  let i = 0
  let keyCounter = 0
  const key = () => keyCounter++

  while (i < lines.length) {
    const line = lines[i]

    // Skip empty lines
    if (line.trim() === '') { i++; continue }

    // H1
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={key()} style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 900, color: C.text, marginBottom: 16, marginTop: 32, lineHeight: 1.2 }}>
          {renderInline(line.slice(2))}
        </h1>
      )
      i++; continue
    }

    // H2
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key()} style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 900, color: C.text, marginBottom: 12, marginTop: 40, lineHeight: 1.3 }}>
          {renderInline(line.slice(3))}
        </h2>
      )
      i++; continue
    }

    // H3
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key()} style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 10, marginTop: 28 }}>
          {renderInline(line.slice(4))}
        </h3>
      )
      i++; continue
    }

    // Tip callout > [!TIP]
    if (line.startsWith('> [!TIP]')) {
      const tipLines = []
      i++
      while (i < lines.length && lines[i].startsWith('> ')) {
        tipLines.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <div key={key()} style={{ background: `${C.teal}15`, border: `1px solid ${C.teal}44`, borderLeft: `4px solid ${C.teal}`, borderRadius: '0 10px 10px 0', padding: '16px 20px', marginBottom: 20, marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>💡 Tip</div>
          <div style={{ color: C.text, fontSize: 14, lineHeight: 1.7 }}>{tipLines.map((l, idx) => <span key={idx}>{renderInline(l)}<br /></span>)}</div>
        </div>
      )
      continue
    }

    // Warning callout > [!WARNING]
    if (line.startsWith('> [!WARNING]')) {
      const warnLines = []
      i++
      while (i < lines.length && lines[i].startsWith('> ')) {
        warnLines.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <div key={key()} style={{ background: '#F5C84215', border: `1px solid ${C.gold}44`, borderLeft: `4px solid ${C.gold}`, borderRadius: '0 10px 10px 0', padding: '16px 20px', marginBottom: 20, marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>⚠️ Note</div>
          <div style={{ color: C.text, fontSize: 14, lineHeight: 1.7 }}>{warnLines.map((l, idx) => <span key={idx}>{renderInline(l)}<br /></span>)}</div>
        </div>
      )
      continue
    }

    // Regular blockquote
    if (line.startsWith('> ')) {
      const quoteLines = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <blockquote key={key()} style={{ borderLeft: `3px solid ${C.accent}`, paddingLeft: 20, margin: '20px 0', color: C.muted, fontSize: 16, fontStyle: 'italic', lineHeight: 1.8 }}>
          {quoteLines.map((l, idx) => <span key={idx}>{renderInline(l)}{idx < quoteLines.length - 1 && <br />}</span>)}
        </blockquote>
      )
      continue
    }

    // Code block
    if (line.startsWith('```')) {
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      elements.push(
        <div key={key()} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20, marginTop: 8, overflowX: 'auto' }}>
          <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: 13, color: C.teal, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {codeLines.join('\n')}
          </pre>
        </div>
      )
      continue
    }

    // Inline image ![alt](url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgMatch) {
      elements.push(
        <div key={key()} style={{ margin: '28px 0' }}>
          <img src={imgMatch[2]} alt={imgMatch[1]} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
          {imgMatch[1] && <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 8, fontStyle: 'italic' }}>{imgMatch[1]}</div>}
        </div>
      )
      i++; continue
    }

    // Side-by-side images: [img1](url1) | [img2](url2)
    const sideBySideMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*\|\s*!\[([^\]]*)\]\(([^)]+)\)$/)
    if (sideBySideMatch) {
      elements.push(
        <div key={key()} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '28px 0' }}>
          <div>
            <img src={sideBySideMatch[2]} alt={sideBySideMatch[1]} style={{ width: '100%', borderRadius: 10 }} />
            {sideBySideMatch[1] && <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 6, fontStyle: 'italic' }}>{sideBySideMatch[1]}</div>}
          </div>
          <div>
            <img src={sideBySideMatch[4]} alt={sideBySideMatch[3]} style={{ width: '100%', borderRadius: 10 }} />
            {sideBySideMatch[3] && <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 6, fontStyle: 'italic' }}>{sideBySideMatch[3]}</div>}
          </div>
        </div>
      )
      i++; continue
    }

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<div key={key()} style={{ height: 1, background: C.border, margin: '32px 0' }} />)
      i++; continue
    }

    // Unordered list
    if (line.match(/^[-*] /)) {
      const listItems = []
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        listItems.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <ul key={key()} style={{ margin: '12px 0 20px 0', paddingLeft: 0, listStyle: 'none' }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 15, color: C.text, lineHeight: 1.7 }}>
              <span style={{ color: C.accent, flexShrink: 0, marginTop: 2 }}>✦</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const listItems = []
      let num = 1
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        listItems.push(lines[i].replace(/^\d+\. /, ''))
        i++
      }
      elements.push(
        <ol key={key()} style={{ margin: '12px 0 20px 0', paddingLeft: 0, listStyle: 'none', counterReset: 'list-counter' }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 15, color: C.text, lineHeight: 1.7 }}>
              <span style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.accent, flexShrink: 0, marginTop: 2 }}>{idx + 1}</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      )
      continue
    }

    // Prompt example box [PROMPT] ... [/PROMPT]
    if (line.trim() === '[PROMPT]') {
      const promptLines = []
      i++
      while (i < lines.length && lines[i].trim() !== '[/PROMPT]') {
        promptLines.push(lines[i])
        i++
      }
      i++ // skip [/PROMPT]
      elements.push(
        <div key={key()} style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}44`, borderRadius: 12, padding: '20px 24px', margin: '24px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>✦ Example Prompt</div>
          <p style={{ fontFamily: 'monospace', fontSize: 14, color: C.text, lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}>{promptLines.join('\n')}</p>
        </div>
      )
      continue
    }

    // Regular paragraph
    const paraLines = []
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('>') && !lines[i].startsWith('```') && !lines[i].startsWith('- ') && !lines[i].startsWith('* ') && !lines[i].match(/^\d+\. /) && lines[i].trim() !== '---' && !lines[i].match(/^!\[/)) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length) {
      elements.push(
        <p key={key()} style={{ fontSize: 15, color: C.text, lineHeight: 1.9, marginBottom: 20 }}>
          {renderInline(paraLines.join(' '))}
        </p>
      )
    }
  }

  return elements
}

// ── Inline Markdown (bold, italic, code, links) ───────────────
function renderInline(text) {
  if (!text) return null
  const parts = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Italic *text*
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/)
    // Inline code `code`
    const codeMatch = remaining.match(/`([^`]+)`/)
    // Link [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/)

    const matches = [boldMatch, italicMatch, codeMatch, linkMatch].filter(Boolean)
    if (matches.length === 0) {
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }

    const first = matches.reduce((a, b) => a.index < b.index ? a : b)
    if (first.index > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, first.index)}</span>)
    }

    if (first === boldMatch) {
      parts.push(<strong key={key++} style={{ color: C.text, fontWeight: 700 }}>{first[1]}</strong>)
      remaining = remaining.slice(first.index + first[0].length)
    } else if (first === italicMatch) {
      parts.push(<em key={key++} style={{ color: C.muted, fontStyle: 'italic' }}>{first[1]}</em>)
      remaining = remaining.slice(first.index + first[0].length)
    } else if (first === codeMatch) {
      parts.push(<code key={key++} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace', fontSize: 13, color: C.teal }}>{first[1]}</code>)
      remaining = remaining.slice(first.index + first[0].length)
    } else if (first === linkMatch) {
      parts.push(<a key={key++} href={first[2]} target="_blank" rel="noopener noreferrer" style={{ color: C.accent, textDecoration: 'underline' }}>{first[1]}</a>)
      remaining = remaining.slice(first.index + first[0].length)
    }
  }

  return parts
}

// ── Blog Post Page ────────────────────────────────────────────
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
  const readTime = Math.max(1, Math.ceil((post.content || '').split(' ').length / 200))

  return (
    <div style={{ padding: '40px 20px', maxWidth: 780, margin: '0 auto' }}>
      {/* Back */}
      <button onClick={() => navigate('/blog')}
        style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', color: C.muted, fontSize: 12, cursor: 'pointer', marginBottom: 32 }}>
        ← Back to Blog
      </button>

      {/* Cover image */}
      {post.cover_image && (
        <div style={{ width: '100%', height: 380, borderRadius: 16, overflow: 'hidden', marginBottom: 36, background: `linear-gradient(135deg, ${C.accent}30, ${C.teal}20)` }}>
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
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px, 5vw, 42px)', fontWeight: 900, color: C.text, marginBottom: 16, lineHeight: 1.2 }}>{post.title}</h1>

      {/* Excerpt */}
      {post.excerpt && (
        <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.8, marginBottom: 32, borderLeft: `3px solid ${C.accent}`, paddingLeft: 20, fontStyle: 'italic' }}>{post.excerpt}</p>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: C.border, marginBottom: 40 }} />

      {/* Rich content */}
      <div>
        {renderMarkdown(post.content)}
      </div>

      {/* CTA box */}
      <div style={{ background: `linear-gradient(135deg, ${C.accent}18, ${C.teal}12)`, border: `1px solid ${C.accent}33`, borderRadius: 16, padding: '28px 32px', margin: '40px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>✦</div>
        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 8 }}>Ready to create?</h3>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: 20, lineHeight: 1.7 }}>Try Dream AI and generate your first artwork in seconds. No experience needed.</p>
        <a href="/create" style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '12px 28px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>Start Creating Free ✦</a>
      </div>

      {/* Share */}
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
