export { type Locale, defaultLocale } from './types';
export { type LocaleEntry, supportedLocales } from './locales';
export type TranslationKey = string;

// Server-side translations — safe to use in React Server Components
export { translate, getClientTranslation } from './server';
