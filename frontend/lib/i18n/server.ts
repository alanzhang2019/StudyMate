import i18n from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { supportedLocales } from './locales';
import { defaultLocale } from './types';

const serverI18n = i18n.createInstance();

serverI18n
  .use(resourcesToBackend((language: string) => import(`./locales/${language}.json`)))
  .init({
    lng: defaultLocale,
    fallbackLng: defaultLocale,
    supportedLngs: supportedLocales.map((l) => l.code),
    interpolation: {
      escapeValue: false,
    },
  });

export function translate(locale: string, key: string, options?: Record<string, unknown>): string {
  return serverI18n.t(key, { lng: locale, ...options });
}

export function getClientTranslation(key: string): string {
  return serverI18n.t(key);
}
