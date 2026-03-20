import { createClient } from '@supabase/supabase-js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
}

export function corsResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS })
}

export function optionsResponse() {
  return new Response('', { status: 200, headers: CORS })
}

const rateLimitMap = new Map()
export function checkRateLimit(key, maxPerMinute = 20) {
  const now = Date.now()
  const windowMs = 60_000
  const entry = rateLimitMap.get(key) || { count: 0, windowStart: now }
  if (now - entry.windowStart > windowMs) {
    rateLimitMap.set(key, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= maxPerMinute) return false
  entry.count++
  rateLimitMap.set(key, entry)
  return true
}

// Decode JWT payload without verification — used as fallback when no service role key
function decodeJWT(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch { return null }
}

function makeSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SECRET_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error(`Supabase env vars missing`)
  const keyType = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role ✅'
    : process.env.SUPABASE_SECRET_KEY ? 'secret_key'
    : process.env.VITE_SUPABASE_ANON_KEY ? 'anon_fallback ⚠️'
    : 'unknown'
  console.log(`[auth] Supabase key: ${keyType}, URL set: ${!!url}`)
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function requireAuth(req) {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim()
  if (!token) throw corsResponse({ error: 'Authentication required' }, 401)

  const hasServiceKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)

  if (hasServiceKey) {
    // Full verification via Supabase
    const supabase = makeSupabase()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw corsResponse({ error: 'Invalid or expired session' }, 401)
    const { data: profile } = await supabase
      .from('profiles').select('is_suspended, subscription_tier').eq('id', user.id).single()
    if (profile?.is_suspended) throw corsResponse({ error: 'Account suspended' }, 403)
    return { user, profile, supabase }
  }

  // Fallback — decode JWT locally when only anon key available
  console.warn('No service role key — using JWT decode fallback')
  const payload = decodeJWT(token)
  if (!payload?.sub) throw corsResponse({ error: 'Invalid or expired session' }, 401)

  const user = { id: payload.sub, email: payload.email }
  const supabase = makeSupabase()
  const { data: profile } = await supabase
    .from('profiles').select('is_suspended, subscription_tier').eq('id', user.id).single()
  if (profile?.is_suspended) throw corsResponse({ error: 'Account suspended' }, 403)

  return { user, profile, supabase }
}

export async function requireAuthLight(req) {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim()
  if (!token) throw corsResponse({ error: 'Authentication required' }, 401)

  const hasServiceKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)

  if (hasServiceKey) {
    const supabase = makeSupabase()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw corsResponse({ error: 'Invalid or expired session' }, 401)
    return { user, supabase }
  }

  console.warn('No service role key — using JWT decode fallback')
  const payload = decodeJWT(token)
  if (!payload?.sub) throw corsResponse({ error: 'Invalid or expired session' }, 401)
  const user = { id: payload.sub, email: payload.email }
  const supabase = makeSupabase()
  return { user, supabase }
}
