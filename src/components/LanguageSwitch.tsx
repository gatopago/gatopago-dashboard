'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { setUserLocale } from '../i18n/locale';

/** Switches the console to the other language; the server renders the page again in it. */
export function LanguageSwitch({ className }: { className: string }) {
  const locale = useLocale();
  const t = useTranslations('Language');
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => startTransition(() => setUserLocale(locale === 'en' ? 'es' : 'en'))}
    >
      {t('other')}
    </button>
  );
}
