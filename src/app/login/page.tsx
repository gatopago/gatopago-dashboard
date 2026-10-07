import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Login } from '../../components/Login';
import { settings } from '../../lib/settings';

export const metadata: Metadata = { title: 'Entrar' };

export default function Page() {
  return (
    <Suspense>
      <Login settings={settings} />
    </Suspense>
  );
}
