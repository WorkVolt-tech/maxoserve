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

 async function refreshRole() {
    if (!session?.user) return
    setRoleLoading(true)
    const { data } = await supabase
      .from('business_members')
      .select('business_id, role')
      .eq('user_id', session.user.id)
      .limit(1)
      .single()
    setBusinessId(data?.business_id || null)
    setRole(data?.role || null)
    setRoleLoading(false)
  }

  useEffect(() => {
    if (!session?.user) {
      setBusinessId(null)
      setRole(null)
      setRoleLoading(false)
      return
    }
    refreshRole()
  }, [session?.user?.id])

 const value = {
    session,
    user: session?.user ?? null,
    loading,
    businessId,
    role,
    roleLoading,
    refreshRole,
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
