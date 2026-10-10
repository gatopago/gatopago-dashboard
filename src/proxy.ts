import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { settings } from './lib/settings';
import { documentCsp, securityHeaders } from './security';

/** Every page gets its own CSP nonce; Next adds it to the scripts it renders. */
export function proxy(request: NextRequest) {
  const nonce = randomBytes(32).toString('base64');
  const csp = documentCsp({
    nonce,
    apiOrigin: settings.apiOrigin,
    development: process.env.NODE_ENV === 'development',
    secure: request.nextUrl.protocol === 'https:',
  });
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  for (const [name, value] of Object.entries(securityHeaders)) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static/|_next/image|favicon\\.svg$|Logo_gatopago\\.svg$).*)'],
};
