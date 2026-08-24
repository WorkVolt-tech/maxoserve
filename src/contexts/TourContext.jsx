import { createContext, useContext, useState } from 'react'
import { TOUR_STEPS } from '../lib/tourSteps'

const TourContext = createContext(null)

export function TourProvider({ children }) {
  const [isActive, setIsActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  function startTour() {
    setStepIndex(0)
    setIsActive(true)
  }

  function next() {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      setIsActive(false)
      return
    }
    setStepIndex((i) => i + 1)
  }

  function back() {
    setStepIndex((i) => Math.max(0, i - 1))
  }

  function skip() {
    setIsActive(false)
  }

  return (
    <TourContext.Provider value={{ isActive, stepIndex, steps: TOUR_STEPS, startTour, next, back, skip }}>
      {children}
    </TourContext.Provider>
  )
}

export function useTour() {
  return useContext(TourContext)
}
