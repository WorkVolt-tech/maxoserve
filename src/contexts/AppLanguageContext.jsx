import { createContext, useContext, useState, useEffect } from 'react'
import { t as translate } from '../i18n/translations'

const AppLanguageContext = createContext(null)

export function AppLanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('maxoserve_admin_lang') || 'en')

  useEffect(() => {
    localStorage.setItem('maxoserve_admin_lang', lang)
  }, [lang])

  function setLang(newLang) {
    setLangState(newLang)
  }

  const t = (key) => translate(lang, key)

  return (
    <AppLanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </AppLanguageContext.Provider>
  )
}

export function useAppLanguage() {
  return useContext(AppLanguageContext)
}
