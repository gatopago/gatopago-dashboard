import { currentSession, signOut } from './session';

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
  // Every route answers a JSON object; anything else is not an answer to trust.
  const value: unknown = await response.json().catch(() => undefined);
  const body =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as { error_code?: unknown })
      : null;
  // Only the session in use: a late answer to an earlier one must not sign out the new one.
  if (
    response.status === 401 &&
    init.token &&
    init.token === currentSession()?.token &&
    path.startsWith('/v1/')
  )
    signOut();
  if (!response.ok)
    throw new ApiError(
      response.status,
      typeof body?.error_code === 'string' ? body.error_code : 'UNAVAILABLE',
    );
  if (!body) throw new ApiError(response.status, 'INVALID_RESPONSE');
  return body as T;
}
