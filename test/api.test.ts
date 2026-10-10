import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal('fetch', async () =>
    Response.json({ error_code: 'UNAUTHENTICATED' }, { status: 401 }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('a rejected session', () => {
  it('signs out only when it is the one in use', async () => {
    const { api } = await import('../src/lib/api');
    const { currentSession, saveSession } = await import('../src/lib/session');
    saveSession({
      token: 'new',
      expiresAt: 4102444800,
      address: '0x2222222222222222222222222222222222222222',
    });
    // A late answer to the session the console used before.
    await expect(api('https://api.gatopago.com', '/v1/charges', { token: 'old' })).rejects.toThrow(
      'UNAUTHENTICATED',
    );
    expect(currentSession()?.token).toBe('new');
    await expect(api('https://api.gatopago.com', '/v1/charges', { token: 'new' })).rejects.toThrow(
      'UNAUTHENTICATED',
    );
    expect(currentSession()).toBeNull();
  });
});
