import en from './en.json';
import it from './it.json';

const translations = { en, it } as const;

export type Locale = keyof typeof translations;
export const locales: Locale[] = ['en', 'it'];
export const defaultLocale: Locale = 'en';

export function getTranslations(locale: Locale) {
  return translations[locale] || translations[defaultLocale];
}

export function getLocaleFromUrl(url: URL): Locale {
  const [, lang] = url.pathname.split('/');
  if (lang && locales.includes(lang as Locale)) {
    return lang as Locale;
  }
  return defaultLocale;
}

export function getLocalizedPath(path: string, locale: Locale): string {
  // Remove leading slash and any existing locale prefix
  const cleanPath = path.replace(/^\/?(en|it)?\//, '');
  return `/${locale}/${cleanPath}`.replace(/\/$/, '') || `/${locale}`;
}
