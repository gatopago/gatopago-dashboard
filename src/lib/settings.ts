import { walletNetwork } from '@gatopago/shared/networks';

/** Settings that client components receive as props; all of them are public. */
export interface ClientSettings {
  /** This console's origin. */
  readonly businessOrigin: string;
  /** The GatoPago app: its domain is the passkeys' (WebAuthn `rpId`). */
  readonly webOrigin: string;
  /** Wallet Core (sign-in) and Flow (`/v1`, the console's data). */
  readonly apiOrigin: string;
  /** Where merchants receive; accounts are derived and read there. */
  readonly homeNetwork: string;
  /** Optional RPC per network for the browser's reads; each falls back to the public one. */
  readonly rpcUrls: Readonly<Record<string, string>>;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function origin(name: string): string {
  const value = required(name);
  if (new URL(value).origin !== value) throw new Error(`${name} must be an origin`);
  return value;
}

const homeNetwork = required('GATOPAGO_HOME_NETWORK');
walletNetwork(homeNetwork);

const rpcUrls: Record<string, string> = JSON.parse(
  process.env.GATOPAGO_WALLET_RPC_URLS?.trim() || '{}',
);
for (const [id, url] of Object.entries(rpcUrls))
  if (new URL(url).protocol !== 'https:')
    throw new Error(`GATOPAGO_WALLET_RPC_URLS: invalid entry for ${id}`);

/** Deployment settings, read once on the server; a missing or invalid one fails the build. */
export const settings: ClientSettings = {
  businessOrigin: origin('GATOPAGO_BUSINESS_ORIGIN'),
  webOrigin: origin('GATOPAGO_WEB_ORIGIN'),
  apiOrigin: origin('GATOPAGO_API_ORIGIN'),
  homeNetwork,
  rpcUrls,
};
