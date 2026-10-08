import { walletNetwork } from '@gatopago/shared/networks';

/** Settings that client components receive as props; all of them are public. */
export interface ClientSettings {
  /** This console's origin. */
  readonly businessOrigin: string;
  /** The GatoPago app, where the QR links. */
  readonly webOrigin: string;
  /** The passkeys' domain (WebAuthn `rpId`): the app's, the same one it uses. */
  readonly passkeyRpId: string;
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

/**
 * `GATOPAGO_PASSKEY_RP_ID`, as the app sets it (by default the app's domain); this console must be
 * on that domain or under it to use its passkeys.
 */
function passkeyRpId(webOrigin: string, businessOrigin: string): string {
  const rpId = process.env.GATOPAGO_PASSKEY_RP_ID?.trim() || new URL(webOrigin).hostname;
  const host = new URL(businessOrigin).hostname;
  if (host !== rpId && !host.endsWith(`.${rpId}`))
    throw new Error('GATOPAGO_PASSKEY_RP_ID must be this console domain or a parent of it');
  return rpId;
}

const businessOrigin = origin('GATOPAGO_BUSINESS_ORIGIN');
const webOrigin = origin('GATOPAGO_WEB_ORIGIN');

/** Deployment settings, read once on the server; a missing or invalid one fails the build. */
export const settings: ClientSettings = {
  businessOrigin,
  webOrigin,
  passkeyRpId: passkeyRpId(webOrigin, businessOrigin),
  apiOrigin: origin('GATOPAGO_API_ORIGIN'),
  homeNetwork,
  rpcUrls,
};
