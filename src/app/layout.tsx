import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import '@fontsource-variable/recursive/full.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'GatoPago Negocios', template: '%s · GatoPago Negocios' },
  description: 'Cobros en USDC, claves API y webhooks de tu negocio en GatoPago.',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = { themeColor: '#fff8f0' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Rendered per request, so Next adds the proxy's CSP nonce to its scripts.
  await headers();
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
