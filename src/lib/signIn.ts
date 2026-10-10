import type { Address, Hex } from 'viem';
import { api } from './api';
import { saveSession, type Session } from './session';
import type { ClientSettings } from './settings';

export interface SessionResponse {
  token: string;
  expires_at: number;
  address: Address;
}

export function remember(result: SessionResponse): Session {
  const session = { token: result.token, expiresAt: result.expires_at, address: result.address };
  saveSession(session);
  return session;
}

/** A sign-in waiting for the app: its QR (`approve_url`) and the secret that collects it. */
export interface LoginRequest {
  id: string;
  secret: Hex;
  expires_at: number;
  approve_url: string;
}

/** What the member sees on their phone before approving: this browser, in a few words. */
export function deviceLabel(userAgent: string): string {
  const browser =
    [
      ['Edg/', 'Edge'],
      ['OPR/', 'Opera'],
      ['Firefox/', 'Firefox'],
      ['Chrome/', 'Chrome'],
      ['Safari/', 'Safari'],
    ].find(([token]) => userAgent.includes(token))?.[1] ?? 'Navegador';
  const system =
    [
      ['Windows', 'Windows'],
      ['Mac OS X', 'macOS'],
      ['Android', 'Android'],
      ['iPhone', 'iPhone'],
      ['iPad', 'iPad'],
      ['Linux', 'Linux'],
    ].find(([token]) => userAgent.includes(token))?.[1] ?? null;
  return system ? `${browser} · ${system}` : browser;
}

/** A sign-in QR; with `publicKey`, approving it also approves that Business key (`signInHere`). */
export const requestLogin = (settings: ClientSettings, publicKey?: Hex) =>
  api<LoginRequest>(settings.apiOrigin, '/app/v1/business-login', {
    body: { device: deviceLabel(navigator.userAgent), public_key: publicKey },
  });

/** Asks once whether the app approved `request`; returns the session when it did. */
export async function collectLogin(
  settings: ClientSettings,
  request: LoginRequest,
  signal: AbortSignal,
): Promise<'pending' | 'expired' | Session> {
  const result = await api<
    { status: 'pending' | 'expired' } | ({ status: 'approved' } & SessionResponse)
  >(settings.apiOrigin, `/app/v1/business-login/${request.id}`, { token: request.secret, signal });
  return result.status === 'approved' ? remember(result) : result.status;
}
