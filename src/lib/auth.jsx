import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const auth = useAuthInternal()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

function useAuthInternal() {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const profileCacheRef = useRef({})

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      const u = session?.user ?? null
      setUser(u)
      if (u) loadProfile(u.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
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

  // ── Sign in with email + password ─────────────────────────────────────────
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  // ── Sign up with email + password + username ──────────────────────────────
  const signUp = async (email, password, username) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: username },
        emailRedirectTo: 'https://trydreamscape.com',
      },
    })
    if (!error && data.user) {
      // Create profile row immediately (may already exist via trigger, upsert is safe)
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username,
        display_name: username,
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    }
    return { data, error }
  }

  // ── Sign in with Google OAuth ─────────────────────────────────────────────
  // This triggers a redirect — there's no async return to wait on.
  // The SIGNED_IN auth state change fires when the user lands back on the site.
  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account', // always show account picker
        },
      },
    })
    return { data, error }
  }

  // ── Sign out ──────────────────────────────────────────────────────────────
  const signOut = async () => {
    profileCacheRef.current = {}
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const setProfileAndCache = (updater) => {
    setProfile(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (next && user?.id) profileCacheRef.current[user.id] = next
      return next
    })
  }

  return {
    user,
    profile,
    setProfile: setProfileAndCache,
    signOut,
    signIn,
    signUp,
    signInWithGoogle,
    loading,
  }
}
