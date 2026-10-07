import { describe, expect, it } from 'vitest';
import { safeNext } from '../src/lib/next';
import { deviceLabel } from '../src/lib/signIn';

describe('Sign-in', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
      'Chrome · Windows',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
      'Safari · macOS',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0',
      'Edge · Windows',
    ],
    ['curl/8.0', 'Navegador'],
  ])('names the browser the phone approves: %s', (userAgent, label) =>
    expect(deviceLabel(userAgent)).toBe(label),
  );

  it.each([
    [
      '/payments/pi_0123456789abcdef0123456789abcdef',
      '/payments/pi_0123456789abcdef0123456789abcdef',
    ],
    [null, '/'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['/login', '/'],
  ])('returns after signing in only within the console: %s', (value, path) =>
    expect(safeNext(value)).toBe(path),
  );
});
