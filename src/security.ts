import { walletNetworks } from '@gatopago/shared/networks';

/**
 * What the browser may reach: GatoPago's API (Wallet Core and Flow) and, for signing in with a
 * passkey, the home network's RPCs (the account's address and signature checks).
 */
export function documentCsp(input: {
  nonce: string;
  apiOrigin: string;
  rpcUrls: Readonly<Record<string, string>>;
  development: boolean;
  secure: boolean;
}): string {
  const rpcs = Object.values(walletNetworks).flatMap(({ chain }) =>
    chain.rpcUrls.default.http.map((url) => new URL(url).origin),
  );
  const connections = [
    "'self'",
    input.apiOrigin,
    ...new Set([...rpcs, ...Object.values(input.rpcUrls).map((url) => new URL(url).origin)]),
    ...(input.development ? ['ws://localhost:3001'] : []),
  ];
  return [
    "default-src 'none'",
    `script-src 'nonce-${input.nonce}' 'strict-dynamic'${input.development ? " 'unsafe-eval'" : ''}`,
    "script-src-attr 'none'",
    `style-src 'self' ${input.development ? "'unsafe-inline'" : `'nonce-${input.nonce}'`}`,
    "style-src-attr 'unsafe-inline'",
    `connect-src ${connections.join(' ')}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(input.secure ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export const securityHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), publickey-credentials-get=(self)',
} as const;
