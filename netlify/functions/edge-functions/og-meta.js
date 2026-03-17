// netlify/edge-functions/og-meta.js
// Intercepts social crawler requests and injects correct OG meta tags
// for blog posts and other dynamic pages

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('VITE_SUPABASE_ANON_KEY')

const SOCIAL_CRAWLERS = /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot|pinterest|snapchat/i

const DEFAULT_IMAGE = 'https://trydreamscape.com/og-image.png'
const SITE_NAME = 'Dreamscape'
const DEFAULT_TITLE = 'Dreamscape — Where Artists Create & Thrive'
const DEFAULT_DESC = 'AI-powered art creation, artist profiles, and a global print-on-demand marketplace.'

function buildMetaHTML(meta) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="${meta.type || 'website'}" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:url" content="${escapeHtml(meta.url)}" />
  <meta property="og:title" content="${escapeHtml(meta.title)}" />
  <meta property="og:description" content="${escapeHtml(meta.description)}" />
  <meta property="og:image" content="${escapeHtml(meta.image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(meta.title)}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@trydreamscape" />
  <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
  <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
  <meta name="twitter:image" content="${escapeHtml(meta.image)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(meta.title)}" />

  <!-- Redirect real users to the actual page -->
  <link rel="canonical" href="${escapeHtml(meta.url)}" />
</head>
<body>
  <h1>${escapeHtml(meta.title)}</h1>
  <p>${escapeHtml(meta.description)}</p>
  <img src="${escapeHtml(meta.image)}" alt="${escapeHtml(meta.title)}" />
</body>
</html>`
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function fetchBlogPost(slug) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=title,excerpt,cover_image,content,author,category&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    )
    const data = await res.json()
    return data?.[0] || null
  } catch {
    return null
  }
}

export default async function handler(request, context) {
  const ua = request.headers.get('user-agent') || ''

  // Only intercept social crawlers — let real users through
  if (!SOCIAL_CRAWLERS.test(ua)) {
    return context.next()
  }

  const url = new URL(request.url)
  const path = url.pathname

  // ── Blog post: /blog/:slug ─────────────────────────────────
  const blogMatch = path.match(/^\/blog\/([^/]+)\/?$/)
  if (blogMatch) {
    const slug = blogMatch[1]
    const post = await fetchBlogPost(slug)

    if (post) {
      const desc = post.excerpt ||
        (post.content || '').replace(/<[^>]*>/g, '').slice(0, 160).trim()

      const meta = {
        title: `${post.title} | ${SITE_NAME}`,
        description: desc,
        image: post.cover_image || DEFAULT_IMAGE,
        url: request.url,
        type: 'article',
      }

      return new Response(buildMetaHTML(meta), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' },
      })
    }
  }

  // ── Artist profile: /u/:username ───────────────────────────
  const profileMatch = path.match(/^\/u\/([^/]+)\/?$/)
  if (profileMatch) {
    const username = profileMatch[1]
    const meta = {
      title: `@${username} — Artist on ${SITE_NAME}`,
      description: `View ${username}'s AI artwork, shop their products, and follow them on Dreamscape.`,
      image: DEFAULT_IMAGE,
      url: request.url,
      type: 'profile',
    }
    return new Response(buildMetaHTML(meta), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' },
    })
  }

  // ── All other pages — pass through ────────────────────────
  return context.next()
}

export const config = {
  path: ['/', '/blog/*', '/u/*', '/marketplace', '/create', '/pricing', '/gallery'],
}
