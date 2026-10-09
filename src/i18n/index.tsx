import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import fr from './fr.json';

export type Language = 'fr' | 'ar';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  isRtl: boolean;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string | Date) => string;
}

const translations: Record<Language, any> = { fr, ar: fr }; // fallback ar to fr for now

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const language: Language = 'fr';
  const isRtl = false;

  useEffect(() => {
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = language;
    localStorage.setItem('aquadro_pos_lang', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    // No-op, only French is supported
  };

  const t = (key: string, fallback?: string): string => {
    const keys = key.split('.');
    let current = translations[language];

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return fallback || key;
      }
    }

    return typeof current === 'string' ? current : fallback || key;
  };

  const formatCurrency = (amount: number): string => {
    const formatted = Math.round(amount).toLocaleString('fr-FR');
    return `${formatted} DA`;
  };

  const formatDate = (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('fr-DZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, isRtl, formatCurrency, formatDate }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
