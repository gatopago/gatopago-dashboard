import type { Metadata } from 'next';
import { Payments } from '../../../components/Payments';

export const metadata: Metadata = { title: 'Cobros' };

export default function Page() {
  return <Payments />;
}
