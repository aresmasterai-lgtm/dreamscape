import { createClient } from '@supabase/supabase-js'

const STATIC_PAGES = [
  { path: '/',            priority: '1.0', changefreq: 'daily'   },
  { path: '/marketplace', priority: '0.9', changefreq: 'daily'   },
  { path: '/gallery',     priority: '0.9', changefreq: 'daily'   },
  { path: '/create',      priority: '0.8', changefreq: 'weekly'  },
  { path: '/blog',        priority: '0.8', changefreq: 'daily'   },
  { path: '/pricing',     priority: '0.7', changefreq: 'monthly' },
  { path: '/contact',     priority: '0.5', changefreq: 'monthly' },
  { path: '/terms',       priority: '0.3', changefreq: 'yearly'  },
  { path: '/privacy',     priority: '0.3', changefreq: 'yearly'  },
  { path: '/sitemap',     priority: '0.3', changefreq: 'monthly' },
]

const today = new Date().toISOString().split('T')[0]

export default async (req) => {
  const headers = {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  }

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    )

    // Fetch public artist profiles (non-suspended, has username)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('username, updated_at')
      .not('username', 'is', null)
      .eq('is_suspended', false)
      .order('updated_at', { ascending: false })

    // Fetch published blog posts
    const { data: blogPosts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at')
      .eq('status', 'published')
      .not('slug', 'is', null)
      .order('published_at', { ascending: false })

    // Build XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n`

    // Static pages
    xml += `  <!-- Static Pages -->\n`
    for (const page of STATIC_PAGES) {
      xml += `  <url>\n`
      xml += `    <loc>https://trydreamscape.com${page.path}</loc>\n`
      xml += `    <lastmod>${today}</lastmod>\n`
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`
      xml += `    <priority>${page.priority}</priority>\n`
      xml += `  </url>\n\n`
    }

    // Blog posts — individual post pages are high-value for SEO
    if (blogPosts?.length) {
      xml += `  <!-- Blog Posts -->\n`
      for (const post of blogPosts) {
        const lastmod = (post.updated_at || post.published_at || today).split('T')[0]
        xml += `  <url>\n`
        xml += `    <loc>https://trydreamscape.com/blog/${post.slug}</loc>\n`
        xml += `    <lastmod>${lastmod}</lastmod>\n`
        xml += `    <changefreq>monthly</changefreq>\n`
        xml += `    <priority>0.7</priority>\n`
        xml += `  </url>\n\n`
      }
    }

    // Artist profile pages — each one is a unique indexable page
    if (profiles?.length) {
      xml += `  <!-- Artist Profiles -->\n`
      for (const profile of profiles) {
        const lastmod = profile.updated_at?.split('T')[0] || today
        xml += `  <url>\n`
        xml += `    <loc>https://trydreamscape.com/u/${profile.username}</loc>\n`
        xml += `    <lastmod>${lastmod}</lastmod>\n`
        xml += `    <changefreq>weekly</changefreq>\n`
        xml += `    <priority>0.6</priority>\n`
        xml += `  </url>\n\n`
      }
    }

    xml += `</urlset>`

    return new Response(xml, { status: 200, headers })

  } catch (err) {
    // Fallback to static-only if Supabase is unavailable
    console.error('Dynamic sitemap error:', err.message)
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://trydreamscape.com/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>
  <url><loc>https://trydreamscape.com/marketplace</loc><lastmod>${today}</lastmod><priority>0.9</priority></url>
  <url><loc>https://trydreamscape.com/gallery</loc><lastmod>${today}</lastmod><priority>0.9</priority></url>
  <url><loc>https://trydreamscape.com/create</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>
  <url><loc>https://trydreamscape.com/blog</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>
  <url><loc>https://trydreamscape.com/pricing</loc><lastmod>${today}</lastmod><priority>0.7</priority></url>
  <url><loc>https://trydreamscape.com/contact</loc><lastmod>${today}</lastmod><priority>0.5</priority></url>
  <url><loc>https://trydreamscape.com/terms</loc><lastmod>${today}</lastmod><priority>0.3</priority></url>
  <url><loc>https://trydreamscape.com/privacy</loc><lastmod>${today}</lastmod><priority>0.3</priority></url>
</urlset>`
    return new Response(fallback, { status: 200, headers })
  }
}

export const config = { path: '/sitemap.xml' }
