import { createContext, useContext, useState } from 'react'
import { t as translate } from '../i18n/translations'

const LanguageContext = createContext(null)

export function LanguageProvider({ children, defaultLang = 'en' }) {
  const [lang, setLang] = useState(defaultLang)

  const t = (key) => translate(lang, key)

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
