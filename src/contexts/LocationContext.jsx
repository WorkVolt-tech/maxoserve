import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'

const LocationContext = createContext(null)

export function LocationProvider({ children }) {
  const { businessId } = useAuth()
  const [locations, setLocations] = useState([])
  const [currentLocationId, setCurrentLocationIdState] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!businessId) {
      setLoading(false)
      return
    }
    loadLocations()
  }, [businessId])

  async function loadLocations() {
    setLoading(true)

    const { data } = await supabase
      .from('locations')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true })

    const list = data || []
    setLocations(list)

    const storageKey = `maxoserve_current_location_${businessId}`
    const saved = localStorage.getItem(storageKey)
    const savedIsValid = saved && list.some((l) => l.id === saved)

    if (savedIsValid) {
      setCurrentLocationIdState(saved)
    } else if (list.length > 0) {
      setCurrentLocationIdState(list[0].id)
      localStorage.setItem(storageKey, list[0].id)
    } else {
      setCurrentLocationIdState('')
    }

    setLoading(false)
  }

  function setCurrentLocationId(id) {
    setCurrentLocationIdState(id)
    if (businessId) {
      localStorage.setItem(`maxoserve_current_location_${businessId}`, id)
    }
  }

  return (
    <LocationContext.Provider
      value={{
        locations,
        currentLocationId,
        setCurrentLocationId,
        locationsLoading: loading,
        reloadLocations: loadLocations,
      }}
    >
      {children}
    </LocationContext.Provider>
  )
}

export function useCurrentLocation() {
  return useContext(LocationContext)
}
