import { createClient } from '@supabase/supabase-js'

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/marketplace', priority: '0.9', changefreq: 'daily' },
  { path: '/gallery', priority: '0.8', changefreq: 'daily' },
  { path: '/channels', priority: '0.8', changefreq: 'daily' },
  { path: '/create', priority: '0.8', changefreq: 'weekly' },
  { path: '/pricing', priority: '0.7', changefreq: 'monthly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/sitemap', priority: '0.3', changefreq: 'monthly' },
]

const today = new Date().toISOString().split('T')[0]

export default async (req) => {
  const headers = {
    'Content-Type': 'application/xml',
    'Cache-Control': 'public, max-age=3600', // cache for 1 hour
  }

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    )

    // Fetch all public usernames
    const { data: profiles } = await supabase
      .from('profiles')
      .select('username, updated_at')
      .not('username', 'is', null)
      .eq('is_suspended', false)
      .order('updated_at', { ascending: false })

    // Fetch all products
    const { data: products } = await supabase
      .from('products')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })

    // Fetch all channels
    const { data: channels } = await supabase
      .from('channels')
      .select('name, updated_at')
      .order('updated_at', { ascending: false })

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

    // Artist profiles
    if (profiles?.length) {
      xml += `  <!-- Artist Profiles -->\n`
      for (const profile of profiles) {
        const lastmod = profile.updated_at?.split('T')[0] || today
        xml += `  <url>\n`
        xml += `    <loc>https://trydreamscape.com/u/${profile.username}</loc>\n`
        xml += `    <lastmod>${lastmod}</lastmod>\n`
        xml += `    <changefreq>weekly</changefreq>\n`
        xml += `    <priority>0.7</priority>\n`
        xml += `  </url>\n\n`
      }
    }

    // Products
    if (products?.length) {
      xml += `  <!-- Products -->\n`
      for (const product of products) {
        const lastmod = product.created_at?.split('T')[0] || today
        xml += `  <url>\n`
        xml += `    <loc>https://trydreamscape.com/marketplace?product=${product.id}</loc>\n`
        xml += `    <lastmod>${lastmod}</lastmod>\n`
        xml += `    <changefreq>weekly</changefreq>\n`
        xml += `    <priority>0.6</priority>\n`
        xml += `  </url>\n\n`
      }
    }

    // Channels
    if (channels?.length) {
      xml += `  <!-- Channels -->\n`
      for (const channel of channels) {
        const lastmod = channel.updated_at?.split('T')[0] || today
        xml += `  <url>\n`
        xml += `    <loc>https://trydreamscape.com/channels/${channel.name}</loc>\n`
        xml += `    <lastmod>${lastmod}</lastmod>\n`
        xml += `    <changefreq>daily</changefreq>\n`
        xml += `    <priority>0.6</priority>\n`
        xml += `  </url>\n\n`
      }
    }

    xml += `</urlset>`

    return new Response(xml, { status: 200, headers })

  } catch (err) {
    // Fallback to static if something goes wrong
    console.error('Dynamic sitemap error:', err.message)
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://trydreamscape.com/</loc><priority>1.0</priority></url>
  <url><loc>https://trydreamscape.com/marketplace</loc><priority>0.9</priority></url>
  <url><loc>https://trydreamscape.com/gallery</loc><priority>0.8</priority></url>
  <url><loc>https://trydreamscape.com/channels</loc><priority>0.8</priority></url>
  <url><loc>https://trydreamscape.com/pricing</loc><priority>0.7</priority></url>
  <url><loc>https://trydreamscape.com/privacy</loc><priority>0.3</priority></url>
</urlset>`
    return new Response(fallback, { status: 200, headers })
  }
}

export const config = { path: '/sitemap.xml' }
