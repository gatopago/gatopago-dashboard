import { signOut } from './session';

/** A GatoPago API error: its `error_code`, or `NETWORK_ERROR` when it could not be reached. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

/**
 * Calls the GatoPago API: Wallet Core under `/app/v1/…` (signing in) and Flow under `/v1/…` (the
 * console's data). An expired or revoked session signs out.
 */
export async function api<T>(
  apiOrigin: string,
  path: string,
  init: { method?: string; body?: unknown; token?: string; signal?: AbortSignal } = {},
): Promise<T> {
  let response: Response;
  const timeout = AbortSignal.timeout(20_000);
  try {
    response = await fetch(`${apiOrigin}${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: {
        Accept: 'application/json',
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'omit',
      cache: 'no-store',
      signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError(0, 'NETWORK_ERROR');
  }
  const value = await response.json().catch(() => null);
  if (response.status === 401 && init.token && path.startsWith('/v1/')) signOut();
  if (!response.ok) throw new ApiError(response.status, value?.error_code ?? 'UNAVAILABLE');
  return value as T;
}

const messages: Record<string, [es: string, en: string]> = {
  CANCELLED: [
    'Se canceló la confirmación en tu dispositivo. Puedes reintentar.',
    'Confirmation was cancelled on your device. You can try again.',
  ],
  PASSKEY_WITHOUT_PRF: [
    'No encontramos tu cuenta con esta llave en este dispositivo. Entra con el QR desde la app o con tu llave de respaldo.',
    'We could not find your account with this key on this device. Sign in with the QR from the app, or with your backup key.',
  ],
  ACCOUNT_NOT_FOUND: [
    'Esa llave no pertenece a una cuenta de GatoPago. Crea tu cuenta en la app primero.',
    'That key does not belong to a GatoPago account. Create your account in the app first.',
  ],
  RATE_LIMITED: [
    'Hay demasiados intentos. Espera un momento.',
    'Too many attempts. Wait a moment.',
  ],
  NETWORK_ERROR: [
    'No pudimos conectar con GatoPago. Revisa tu conexión y reintenta.',
    'GatoPago cannot be reached. Check your connection and try again.',
  ],
  UNAUTHENTICATED: ['Tu sesión venció. Vuelve a entrar.', 'Your session expired. Sign in again.'],
};

/** A message for the person for any failure: API codes and passkey prompts. */
export function failureMessage(error: unknown, en: boolean): string {
  let code = 'UNKNOWN';
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    if (cause instanceof ApiError) {
      code = cause.code;
      break;
    }
    if (cause.name === 'NotAllowedError' || cause.name === 'AbortError') {
      code = 'CANCELLED';
      break;
    }
  }
  const [es, english] = messages[code] ?? [
    'No pudimos completar este paso. Reintenta.',
    'We could not complete this step. Try again.',
  ];
  return en ? english : es;
}
