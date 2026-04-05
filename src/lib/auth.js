import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

export function useAuth() {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const profileCacheRef = useRef({}) // userId → profile, survives re-renders

  useEffect(() => {
    let mounted = true

    // ── Initial session load ─────────────────────────────────
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      const u = session?.user ?? null
      setUser(u)
      if (u) loadProfile(u.id)
      else setLoading(false)
    })

    // ── Auth state changes ───────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      // Ignore TOKEN_REFRESHED events — these fire on every tab focus
      // and cause unnecessary re-renders. The session is still valid.
      if (event === 'TOKEN_REFRESHED') return

      const u = session?.user ?? null
      setUser(u)

      if (event === 'SIGNED_IN' && u) {
        loadProfile(u.id)
      } else if (event === 'SIGNED_OUT') {
        setProfile(null)
        profileCacheRef.current = {}
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const loadProfile = async (userId) => {
    // Return from cache if available — avoids DB hit on every tab switch
    if (profileCacheRef.current[userId]) {
      setProfile(profileCacheRef.current[userId])
      setLoading(false)
      return
    }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (data) {
        profileCacheRef.current[userId] = data
        setProfile(data)
      }
    } catch {}
    setLoading(false)
  }

  const signOut = async () => {
    profileCacheRef.current = {}
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  // Allow profile updates to also update cache
  const setProfileAndCache = (updater) => {
    setProfile(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (next && user?.id) profileCacheRef.current[user.id] = next
      return next
    })
  }

  return { user, profile, setProfile: setProfileAndCache, signOut, loading }
}
