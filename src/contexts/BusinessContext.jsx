import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'

const BusinessContext = createContext(null)

export function BusinessProvider({ children }) {
  const { user } = useAuth()
  const [businesses, setBusinesses] = useState([])
  const [currentBusinessId, setCurrentBusinessIdState] = useState(
    localStorage.getItem('maxoserve_current_business_id') || null
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    loadBusinesses()
  }, [user])

  async function loadBusinesses() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_my_businesses')

    if (error) {
      console.error('Failed to load businesses:', error)
      setLoading(false)
      return
    }

    const list = data || []
    setBusinesses(list)

    // If no valid current selection (or the previously selected business is
    // no longer one this user belongs to — e.g. access expired), default to
    // the first one.
    const stillValid = list.some((b) => b.business_id === currentBusinessId)
    if (!stillValid && list.length > 0) {
      setCurrentBusinessId(list[0].business_id)
    }

    setLoading(false)
  }

  function setCurrentBusinessId(id) {
    setCurrentBusinessIdState(id)
    localStorage.setItem('maxoserve_current_business_id', id)
  }

  return (
    <BusinessContext.Provider
      value={{ businesses, currentBusinessId, setCurrentBusinessId, businessesLoading: loading, reloadBusinesses: loadBusinesses }}
    >
      {children}
    </BusinessContext.Provider>
  )
}

export function useCurrentBusiness() {
  return useContext(BusinessContext)
}
