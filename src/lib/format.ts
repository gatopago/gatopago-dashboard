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
export const formatAmount = (amount: string, locale: string) =>
  Number(formatUnits(parseUnits(amount, 6), 6)).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

export const formatDate = (seconds: number, locale: string) =>
  new Date(seconds * 1000).toLocaleString(locale, {
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

/** The colors of a charge's status; its name is in the `Status` texts. */
export const statusTone: Record<Intent['status'], string> = {
  requires_payment: 'bg-pending/10 text-pending',
  processing: 'bg-info/10 text-info',
  succeeded: 'bg-growth/15 text-growth',
  canceled: 'bg-surface-2 text-text-faint',
  expired: 'bg-surface-2 text-text-faint',
};
