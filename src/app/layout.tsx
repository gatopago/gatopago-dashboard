import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import '@fontsource-variable/recursive/full.css';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return {
    title: { default: 'GatoPago Negocios', template: '%s · GatoPago Negocios' },
    description: t('description'),
    robots: { index: false, follow: false },
    icons: { icon: '/favicon.svg' },
  };
}

export const viewport: Viewport = { themeColor: '#fff8f0' };

/** Rendered per request (the language's cookie), so Next adds the proxy's CSP nonce to its scripts. */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
