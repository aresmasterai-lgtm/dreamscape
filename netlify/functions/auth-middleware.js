// ── Shared auth middleware for Netlify functions ──────────────
// Verifies the user's Supabase JWT and returns the authenticated user.
// Call requireAuth(req) at the top of any sensitive function.
// Returns { user } on success, throws Response on failure.

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

// Rate limiting — simple in-memory map per function instance
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

// Build Supabase client — service role key preferred, anon key as fallback
// getUser() works with either key; service role only needed for admin writes
function makeSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SECRET_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error(`Supabase env vars missing — URL: ${!!url}, KEY: ${!!key}`)
  return createClient(url, key)
}

export async function requireAuth(req) {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) throw corsResponse({ error: 'Authentication required' }, 401)

  const supabase = makeSupabase()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw corsResponse({ error: 'Invalid or expired session' }, 401)

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_suspended, subscription_tier')
    .eq('id', user.id)
    .single()

  if (profile?.is_suspended) throw corsResponse({ error: 'Account suspended' }, 403)

  return { user, profile, supabase }
}

export async function requireAuthLight(req) {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) throw corsResponse({ error: 'Authentication required' }, 401)

  const supabase = makeSupabase()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw corsResponse({ error: 'Invalid or expired session' }, 401)

  return { user, supabase }
}
