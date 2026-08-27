import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import App from './App.jsx'

Sentry.init({
  dsn: 'https://815cc32d01d0b537abaa04b87c652fc3@o4511980137152512.ingest.us.sentry.io/4511980142329856',
  environment: 'production',
  tracesSampleRate: 0.1,
})
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import { AppLanguageProvider } from './contexts/AppLanguageContext.jsx'
import { TourProvider } from './contexts/TourContext.jsx'
import { BusinessProvider } from './contexts/BusinessContext.jsx'
import './styles/index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BusinessProvider>
          <AppLanguageProvider>
            <TourProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </TourProvider>
          </AppLanguageProvider>
        </BusinessProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
