import type { Address } from 'viem';

/** A GatoPago Business session: Flow accepts it, the wallet does not. */
export interface Session {
  readonly token: string;
  readonly expiresAt: number;
  readonly address: Address;
}

const KEY = 'gatopago.business.session';
const listeners = new Set<() => void>();
let cached: { raw: string | null; session: Session | null } = { raw: null, session: null };

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The current session, or null when signed out or about to expire. Stable between changes. */
export function currentSession(): Session | null {
  const raw = read();
  if (raw !== cached.raw) {
    let session: Session | null = null;
    try {
      const value = raw ? (JSON.parse(raw) as Session) : null;
      if (value && typeof value.token === 'string' && typeof value.address === 'string')
        session = value;
    } catch {
      session = null;
    }
    cached = { raw, session };
  }
  const session = cached.session;
  return session && session.expiresAt > Date.now() / 1000 + 60 ? session : null;
}

function onStorage(event: StorageEvent) {
  if (event.key === KEY || event.key === null) listeners.forEach((listener) => listener());
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

function write(value: Session | null) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: the session cannot outlive this page.
  }
  listeners.forEach((listener) => listener());
}

export const saveSession = (session: Session) => write(session);
export const signOut = () => write(null);
