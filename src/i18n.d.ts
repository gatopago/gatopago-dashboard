import type { LOCALES } from './i18n/config';
import type messages from './messages/es.json';

/** Keys and languages checked when compiling: a missing text fails the build. */
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof LOCALES)[number];
    Messages: typeof messages;
  }
}
