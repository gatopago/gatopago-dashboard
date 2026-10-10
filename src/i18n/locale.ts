'use server';

import { cookies } from 'next/headers';
import { hasLocale, type Locale } from 'next-intl';
import { LOCALE_COOKIE, LOCALES } from './config';

/** Keeps the language chosen in the console's menu for a year; the page renders again in it. */
export async function setUserLocale(locale: Locale) {
  if (!hasLocale(LOCALES, locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}
