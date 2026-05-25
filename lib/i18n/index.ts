import i18n from './config';

export { type Locale, defaultLocale } from './types';
export { type LocaleEntry, supportedLocales } from './locales';
export type TranslationKey = string;

export function translate(locale: string, key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, { lng: locale, ...options });
}

export function getClientTranslation(key: string): string {
  return i18n.t(key);
}
