import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, LOCALES } from './config';

/** next-intl's configuration for each request: the chosen language, or Spanish. */
export default getRequestConfig(async () => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = hasLocale(LOCALES, chosen) ? chosen : 'es';
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
