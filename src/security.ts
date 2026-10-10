/**
 * What the browser may reach: GatoPago's API (Wallet Core and Flow) only. Signing in reads nothing
 * from a chain: the console's key is checked by Wallet Core.
 */
export function documentCsp(input: {
  nonce: string;
  apiOrigin: string;
  development: boolean;
  secure: boolean;
}): string {
  const connections = [
    "'self'",
    input.apiOrigin,
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
