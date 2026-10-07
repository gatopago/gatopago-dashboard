import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PaymentDetail } from '../../../../components/Payments';

export const metadata: Metadata = { title: 'Cobro' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^pi_[0-9a-f]{32}$/.test(id)) notFound();
  return <PaymentDetail id={id} />;
}
