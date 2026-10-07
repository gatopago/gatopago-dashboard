import { formatUnits, parseUnits, type Hex } from 'viem';
import { walletNetwork } from '@gatopago/shared/networks';

/** A GatoPago Flow payment intent, as the merchant API returns it. */
export interface Intent {
  id: string;
  amount: string;
  status: 'requires_payment' | 'processing' | 'succeeded' | 'canceled' | 'expired';
  description: string | null;
  checkout_url: string;
  expires_at: number;
  created_at: number;
  payment: {
    network: string;
    transaction_hash: Hex | null;
    payer: string | null;
    paid_at: number | null;
  } | null;
}

/** A Flow decimal amount ("25.00") in the console's language, with two to six decimals. */
export const formatAmount = (amount: string, en: boolean) =>
  Number(formatUnits(parseUnits(amount, 6), 6)).toLocaleString(en ? 'en' : 'es', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

export const formatDate = (seconds: number, en: boolean) =>
  new Date(seconds * 1000).toLocaleString(en ? 'en' : 'es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export const networkName = (networkId: string) => walletNetwork(networkId).chain.name;

export function explorerUrl(networkId: string, hash: Hex): string | null {
  const explorer = walletNetwork(networkId).chain.blockExplorers?.default.url;
  return explorer ? `${explorer}/tx/${hash}` : null;
}

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export function statusLabel(status: Intent['status'], en: boolean): [label: string, tone: string] {
  return {
    requires_payment: [en ? 'Awaiting payment' : 'Esperando pago', 'bg-pending/10 text-pending'],
    processing: [en ? 'Processing' : 'En proceso', 'bg-info/10 text-info'],
    succeeded: [en ? 'Paid' : 'Pagado', 'bg-growth/15 text-growth'],
    canceled: [en ? 'Canceled' : 'Cancelado', 'bg-surface-2 text-text-faint'],
    expired: [en ? 'Expired' : 'Vencido', 'bg-surface-2 text-text-faint'],
  }[status] as [string, string];
}
