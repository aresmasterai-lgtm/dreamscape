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
// Resets on cold start. Good enough for most abuse scenarios.
const rateLimitMap = new Map()

export function checkRateLimit(key, maxPerMinute = 20) {
  const now = Date.now()
  const windowMs = 60_000
  const entry = rateLimitMap.get(key) || { count: 0, windowStart: now }

  if (now - entry.windowStart > windowMs) {
    // New window
    rateLimitMap.set(key, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= maxPerMinute) {
    return false // Rate limited
  }

  entry.count++
  rateLimitMap.set(key, entry)
  return true
}

// Verify JWT and return the Supabase user.
// Reads Bearer token from Authorization header.
export async function requireAuth(req) {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (!token) {
    throw corsResponse({ error: 'Authentication required' }, 401)
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw corsResponse({ error: 'Invalid or expired session' }, 401)
  }

  // Check if user is suspended
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_suspended, subscription_tier')
    .eq('id', user.id)
    .single()

  if (profile?.is_suspended) {
    throw corsResponse({ error: 'Account suspended' }, 403)
  }

  return { user, profile, supabase }
}

// Lighter version — verify auth but don't fetch profile
// Use for read-only endpoints that just need to know the user is real
export async function requireAuthLight(req) {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (!token) {
    throw corsResponse({ error: 'Authentication required' }, 401)
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw corsResponse({ error: 'Invalid or expired session' }, 401)
  }

  return { user, supabase }
}
