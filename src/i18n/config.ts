/** The console's languages; Spanish is the default. */
export const LOCALES = ['es', 'en'] as const;

/**
 * The language chosen in the console's menu. The console is private and signed in, so the language
 * is the member's choice, not part of its addresses (next-intl without i18n routing).
 */
export const LOCALE_COOKIE = 'NEXT_LOCALE';
