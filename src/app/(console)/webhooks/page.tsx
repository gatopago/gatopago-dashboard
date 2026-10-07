import type { Metadata } from 'next';
import { Webhooks } from '../../../components/Developers';

export const metadata: Metadata = { title: 'Webhooks' };

export default function Page() {
  return <Webhooks />;
}
