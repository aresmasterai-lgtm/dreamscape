import { requireAuth, corsResponse, optionsResponse } from './auth-middleware.js'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, templates } from './send-email.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const { user: follower } = await requireAuth(req)
    const { targetUserId } = await req.json()

    if (!targetUserId || targetUserId === follower.id) {
      return corsResponse({ ok: true }) // silent no-op
    }

    // Get target user's email + notification preference
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('email_notifications, username, display_name')
      .eq('id', targetUserId)
      .single()

    if (targetProfile?.email_notifications === false) {
      return corsResponse({ ok: true, skipped: 'notifications off' })
    }

    // Get target user's email via admin API
    const { data: { user: targetUser } } = await supabase.auth.admin.getUserById(targetUserId)
    if (!targetUser?.email) return corsResponse({ ok: true })

    // Get follower's profile for display name
    const { data: followerProfile } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', follower.id)
      .single()

    // Insert in-app notification
    await supabase.from('notifications').insert({
      user_id: targetUserId,
      type: 'new_follower',
      title: `@${followerProfile?.username} started following you`,
      message: `${followerProfile?.display_name || '@' + followerProfile?.username} is now following your work on Dreamscape.`,
      read: false,
    })

    // Send email
    const emailData = templates.newFollower({
      followerUsername: followerProfile?.username || 'someone',
      followerDisplayName: followerProfile?.display_name,
    })
    await sendEmail({ to: targetUser.email, ...emailData })

    return corsResponse({ ok: true })

  } catch (err) {
    if (err instanceof Response) return err
    console.error('notify-follow error:', err.message)
    return corsResponse({ ok: true }) // never fail silently on the user
  }
}

export const config = { path: '/api/notify-follow' }
