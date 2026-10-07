import type { Metadata } from 'next';
import { ApiKeys } from '../../../components/Developers';

export const metadata: Metadata = { title: 'Claves API' };

export default function Page() {
  return <ApiKeys />;
}
