import { createContext, useContext, useMemo, useState } from 'react';
import { strings } from './strings';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('meno_lang') || 'en');

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const t = (key, fallback, vars) => {
    const table = strings[lang] || strings.en;
    let str = table[key] ?? strings.en[key] ?? fallback ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(`{{${k}}}`, v);
      });
    }
    return str;
  };

  const changeLang = (next) => {
    localStorage.setItem('meno_lang', next);
    setLang(next);
    document.documentElement.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', next);
  };

  const value = useMemo(() => ({ lang, dir, t, setLang: changeLang }), [lang, dir]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
