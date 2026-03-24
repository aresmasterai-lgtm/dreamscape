import { requireAuth, corsResponse, optionsResponse } from './auth-middleware.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SEAT_LIMITS = { merchant: 3, brand: 10, enterprise: Infinity }

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const { user } = await requireAuth(req)
    const { email, role } = await req.json()

    if (!email || !role) return corsResponse({ error: 'email and role required' }, 400)
    if (!['designer', 'viewer'].includes(role)) return corsResponse({ error: 'Invalid role' }, 400)

    // Get inviter's tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    const tier = profile?.subscription_tier || 'free'
    const seatLimit = SEAT_LIMITS[tier]

    if (!seatLimit) {
      return corsResponse({ error: 'Team seats require Merchant tier or above' }, 403)
    }

    // Count active seats
    const { count } = await supabase
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .in('status', ['active', 'pending'])

    if (seatLimit !== Infinity && (count || 0) >= seatLimit) {
      return corsResponse({ 
        error: `Seat limit reached. Your ${tier} plan includes ${seatLimit} team seat${seatLimit !== 1 ? 's' : ''}. Upgrade to add more.`,
        limitReached: true,
      }, 403)
    }

    // Check not already invited
    const { data: existing } = await supabase
      .from('team_members')
      .select('id, status')
      .eq('owner_id', user.id)
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existing && existing.status !== 'removed') {
      return corsResponse({ error: 'This person has already been invited' }, 409)
    }

    // Insert invite
    const { data: invite, error: inviteErr } = await supabase
      .from('team_members')
      .insert({
        owner_id: user.id,
        email: email.toLowerCase(),
        role,
        status: 'pending',
        invited_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (inviteErr) throw inviteErr

    return corsResponse({ success: true, inviteId: invite.id })

  } catch (err) {
    if (err instanceof Response) return err
    console.error('team-invite error:', err.message)
    return corsResponse({ error: err.message }, 500)
  }
}

export const config = { path: '/api/team-invite' }
