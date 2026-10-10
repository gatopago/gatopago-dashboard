import { pageTitle } from '../../i18n/title';
import { Suspense } from 'react';
import { Login } from '../../components/Login';
import { settings } from '../../lib/settings';

export const generateMetadata = pageTitle('login');

export default function Page() {
  return (
    <Suspense>
      <Login settings={settings} />
    </Suspense>
  );
}
