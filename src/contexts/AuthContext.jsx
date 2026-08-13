import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [businessId, setBusinessId] = useState(null)
  const [role, setRole] = useState(null)
  const [roleLoading, setRoleLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setBusinessId(null)
      setRole(null)
      setRoleLoading(false)
      return
    }

    setRoleLoading(true)
    supabase
      .from('business_members')
      .select('business_id, role')
      .eq('user_id', session.user.id)
      .limit(1)
      .single()
      .then(({ data }) => {
        setBusinessId(data?.business_id || null)
        setRole(data?.role || null)
        setRoleLoading(false)
      })
  }, [session?.user?.id])

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    businessId,
    role,
    roleLoading,
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
