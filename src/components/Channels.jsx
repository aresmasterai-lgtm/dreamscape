import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Product Card embedded in feed ─────────────────────────────
function ProductCard({ product, navigate }) {
  if (!product) return null
  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${C.accent}33`,
      borderRadius: 14,
      overflow: 'hidden',
      marginTop: 12,
    }}>
      {product.mockup_url && (
        <img src={product.mockup_url} alt={product.title}
          style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.title}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{product.product_type}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>${parseFloat(product.price || 0).toFixed(2)}</span>
          <button
            onClick={() => navigate(`/marketplace`)}
            style={{
              background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`,
              border: 'none', borderRadius: 8, padding: '7px 14px',
              color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>
            Buy Now ✦
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Single Post Card ──────────────────────────────────────────
function PostCard({ post, user, onLike }) {
  const navigate = useNavigate()
  const avatarLetter = post.profiles?.username?.[0]?.toUpperCase() || '?'
  const username = post.profiles?.username || 'artist'
  const liked = post._liked
  const isProductPost = !!post.product_id

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${isProductPost ? C.accent + '44' : C.border}`,
      borderRadius: 14, padding: '18px 20px', transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = (isProductPost ? C.accent + '88' : C.accent + '44')}
      onMouseLeave={e => e.currentTarget.style.borderColor = (isProductPost ? C.accent + '44' : C.border)}>

      {/* Author row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {avatarLetter}
        </div>
        <div style={{ flex: 1 }}>
          <div onClick={() => navigate(`/u/${username}`)}
            style={{ fontSize: 13, fontWeight: 600, color: C.accent, cursor: 'pointer' }}>@{username}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{timeAgo(post.created_at)}</div>
        </div>
        {isProductPost && (
          <span style={{ fontSize: 10, background: `${C.accent}20`, border: `1px solid ${C.accent}44`, borderRadius: 20, padding: '3px 10px', color: C.accent, fontWeight: 600 }}>
            🛍 New Drop
          </span>
        )}
      </div>

      {/* Caption */}
      {post.content && (
        <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7, marginBottom: isProductPost ? 0 : 12, whiteSpace: 'pre-wrap' }}>{post.content}</p>
      )}

      {/* Product card (if product post) */}
      {isProductPost && post.products ? (
        <ProductCard product={post.products} navigate={navigate} />
      ) : (
        /* Regular image post */
        post.image_url && (
          <img src={post.image_url} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 12, maxHeight: 320, objectFit: 'cover' }} />
        )
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 14 }}>
        <button onClick={() => user && onLike(post)} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none',
          border: `1px solid ${liked ? '#ff6b9d55' : C.border}`, borderRadius: 20,
          padding: '4px 12px', color: liked ? '#ff6b9d' : C.muted,
          fontSize: 12, cursor: user ? 'pointer' : 'default', transition: 'all 0.15s',
        }}>
          {liked ? '❤️' : '🤍'} {post.like_count || 0}
        </button>
        <span style={{ fontSize: 12, color: C.muted }}>💬 {post.reply_count || 0}</span>
      </div>
    </div>
  )
}

// ── Channel View ──────────────────────────────────────────────
function ChannelView({ channel, user, onSignIn, onBack }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [likedIds, setLikedIds] = useState(new Set())
  const textareaRef = useRef(null)

  useEffect(() => { loadPosts() }, [channel.id])

  const loadPosts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('channel_posts')
      .select('*, profiles(username, bio), products(id, title, price, mockup_url, product_type)')
      .eq('channel_id', channel.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setPosts(data?.map(p => ({ ...p, _liked: likedIds.has(p.id) })) || [])
    setLoading(false)
  }

  const submitPost = async () => {
    if (!content.trim() || posting) return
    setPosting(true)
    const { data, error } = await supabase.from('channel_posts').insert({
      channel_id: channel.id,
      user_id: user.id,
      content: content.trim(),
      image_url: '',
      like_count: 0,
      reply_count: 0,
    }).select('*, profiles(username, bio), products(id, title, price, mockup_url, product_type)').single()

    if (!error && data) {
      setPosts(prev => [{ ...data, _liked: false }, ...prev])
      setContent('')
    }
    setPosting(false)
  }

  const handleLike = async (post) => {
    if (likedIds.has(post.id)) return
    const newCount = (post.like_count || 0) + 1
    setLikedIds(prev => new Set([...prev, post.id]))
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, like_count: newCount, _liked: true } : p))
    await supabase.from('channel_posts').update({ like_count: newCount }).eq('id', post.id)
  }

  return (
    <div>
      {/* Channel header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>← Back</button>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: channel.color + '30', border: `1px solid ${channel.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{channel.icon}</div>
        <div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.text, marginBottom: 2 }}>#{channel.display_name}</h2>
          <p style={{ fontSize: 12, color: C.muted }}>{channel.description}</p>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>{channel.member_count?.toLocaleString()} members</div>
      </div>

      {/* Post composer */}
      {user ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px', marginBottom: 24 }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && e.metaKey && submitPost()}
            placeholder={`Share something with #${channel.display_name}...`}
            rows={3}
            style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: 11, color: C.muted }}>⌘ + Enter to post</span>
            <button onClick={submitPost} disabled={posting || !content.trim()} style={{
              background: posting || !content.trim() ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`,
              border: 'none', borderRadius: 8, padding: '8px 20px',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: posting || !content.trim() ? 'not-allowed' : 'pointer',
            }}>
              {posting ? 'Posting...' : 'Post ✦'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 14, color: C.text }}>Sign in to post in this channel</span>
          <button onClick={onSignIn} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sign In</button>
        </div>
      )}

      {/* Posts feed */}
      {loading ? (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '40px 0' }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
        </div>
      ) : posts.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{channel.icon}</div>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6 }}>No posts yet. Be the first to post in <strong style={{ color: C.accent }}>#{channel.display_name}</strong>!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posts.map(post => <PostCard key={post.id} post={post} user={user} onLike={handleLike} />)}
        </div>
      )}
    </div>
  )
}

// ── Channels Home ─────────────────────────────────────────────
export default function Channels({ user, onSignIn }) {
  const { channelName } = useParams()
  const navigate = useNavigate()
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null)

  useEffect(() => {
    supabase.from('channels').select('*').eq('is_live', true).order('member_count', { ascending: false })
      .then(({ data }) => {
        setChannels(data || [])
        setLoading(false)
        if (channelName && data) {
          const match = data.find(c => c.name === channelName)
          if (match) setActive(match)
        }
      })
  }, [channelName])

  const openChannel = (ch) => { setActive(ch); navigate(`/channels/${ch.name}`) }
  const closeChannel = () => { setActive(null); navigate('/channels') }

  if (active) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: 700, margin: '0 auto' }}>
        <ChannelView channel={active} user={user} onSignIn={onSignIn} onBack={closeChannel} />
      </div>
    )
  }

  return (
    <div style={{ padding: '40px 20px', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, marginBottom: 8, color: C.text }}>Channels</h2>
      <p style={{ color: C.muted, marginBottom: 28 }}>Join conversations with artists around the world.</p>

      {!user && (
        <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 14, color: C.text }}>Sign in to post and join the conversation</span>
          <button onClick={onSignIn} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sign In</button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '40px 0' }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {channels.map(ch => (
            <div key={ch.id} onClick={() => openChannel(ch)}
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = ch.color + '88'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: ch.color + '25', border: `1px solid ${ch.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 14 }}>{ch.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>#{ch.display_name}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 14 }}>{ch.description}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.muted }}>{ch.member_count?.toLocaleString()} members</span>
                <span style={{ fontSize: 11, background: ch.color + '22', border: `1px solid ${ch.color}44`, borderRadius: 20, padding: '2px 10px', color: ch.color }}>
                  {ch.is_live ? '● live' : 'offline'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
    </div>
  )
}
