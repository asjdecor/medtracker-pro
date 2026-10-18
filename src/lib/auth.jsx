import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, cloudEnabled } from './supabase'
import { setDbMode, setDbUser } from './db'

/*
 * Two ways in:
 *  - cloud: Supabase account (magic link or Google) → data synced across devices.
 *  - local: no account; data stays in this browser. Always available.
 */
const AuthContext = createContext(null)
const LOCAL_KEY = 'mt.localUser'

const fromSupabase = (u) => u && ({
  id: u.id,
  email: u.email,
  name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Você',
  picture: u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
  mode: 'cloud',
})

const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null') } catch { return null } }

function activate(user) {
  setDbMode(user?.mode || 'local')
  setDbUser(user?.mode === 'cloud' ? user.id : 'local')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub = () => {}
    ;(async () => {
      if (cloudEnabled) {
        const { data } = await supabase.auth.getSession()
        const u = fromSupabase(data.session?.user)
        const next = u || readLocal()
        activate(next); setUser(next)
        const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
          const su = fromSupabase(session?.user)
          if (su) { activate(su); setUser(su) }
        })
        unsub = () => sub.subscription.unsubscribe()
      } else {
        const l = readLocal()
        activate(l); setUser(l)
      }
      setLoading(false)
    })()
    return () => unsub()
  }, [])

  const redirectTo = () => window.location.origin + window.location.pathname

  const value = {
    user,
    loading,
    cloudEnabled,
    async signInWithEmail(email) {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } })
      if (error) throw error
    },
    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })
      if (error) throw error
    },
    startLocal(name) {
      const u = { id: 'local', name: name?.trim() || 'Você', email: '', picture: null, mode: 'local' }
      localStorage.setItem(LOCAL_KEY, JSON.stringify(u))
      activate(u); setUser(u)
    },
    updateLocalName(name) {
      if (user?.mode !== 'local') return
      const u = { ...user, name }
      localStorage.setItem(LOCAL_KEY, JSON.stringify(u)); setUser(u)
    },
    async signOut() {
      if (user?.mode === 'cloud') await supabase.auth.signOut()
      else localStorage.removeItem(LOCAL_KEY)
      activate(null); setUser(null)
      window.location.hash = '#/'
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
