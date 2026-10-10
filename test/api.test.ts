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

describe('an answer', () => {
  it('that is not a JSON object is an error, not an empty success', async () => {
    const { api } = await import('../src/lib/api');
    for (const body of ['not valid json', '', 'null', '[1]']) {
      vi.stubGlobal('fetch', async () => new Response(body, { status: 200 }));
      await expect(api('https://api.gatopago.com', '/v1/charges')).rejects.toThrow(
        'INVALID_RESPONSE',
      );
    }
    vi.stubGlobal('fetch', async () => new Response('<html>', { status: 502 }));
    await expect(api('https://api.gatopago.com', '/v1/charges')).rejects.toThrow('UNAVAILABLE');
    vi.stubGlobal('fetch', async () => Response.json({ charges: [] }));
    expect(await api('https://api.gatopago.com', '/v1/charges')).toEqual({ charges: [] });
  });
});

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
