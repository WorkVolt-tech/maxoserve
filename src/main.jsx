import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import { AppLanguageProvider } from './contexts/AppLanguageContext.jsx'
import { TourProvider } from './contexts/TourContext.jsx'
import './styles/index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppLanguageProvider>
          <TourProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </TourProvider>
        </AppLanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
