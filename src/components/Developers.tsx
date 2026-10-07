'use client';

import { useState } from 'react';
import { failureMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { useConsole, useFlow, useFlowAction } from './Console';
import {
  ConfirmAction,
  Empty,
  Failure,
  OneTimeSecret,
  PageHeader,
  RowsLoading,
} from './Primitives';

/** Runs a change through Flow, then reads the list again. */
function useChange() {
  const { english: en } = useConsole();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const run = (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    action()
      .then(() => setRevision((value) => value + 1))
      .catch((failure: unknown) => setError(failureMessage(failure, en)))
      .finally(() => setBusy(false));
  };
  return { revision, busy, error, run };
}

export function ApiKeys() {
  const { english: en } = useConsole();
  const flow = useFlowAction();
  const { revision, busy, error: actionError, run } = useChange();
  const { data, error } = useFlow<{ data: { id: string; last4: string; created_at: number }[] }>(
    'api_keys',
    revision,
  );
  const [created, setCreated] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        title={en ? 'API keys' : 'Claves API'}
        description={
          en
            ? 'Your server uses a key to create charges and read events. Keep it secret: anyone with it can create charges in your name.'
            : 'Tu servidor usa una clave para crear cobros y leer eventos. Guárdala en secreto: con ella se pueden crear cobros a tu nombre.'
        }
        action={
          <button
            type="button"
            disabled={busy}
            className="btn btn-primary"
            onClick={() =>
              run(() =>
                flow<{ key: string }>('api_keys', { body: {} }).then(({ key }) => setCreated(key)),
              )
            }
          >
            {en ? 'Create API key' : 'Crear clave API'}
          </button>
        }
      />
      {created ? <OneTimeSecret value={created} english={en} /> : null}
      {actionError ? <Failure>{actionError}</Failure> : null}
      {error ? (
        <Failure>{error}</Failure>
      ) : !data ? (
        <RowsLoading count={2} />
      ) : data.data.length === 0 ? (
        <Empty>{en ? 'No keys yet.' : 'Todavía no hay claves.'}</Empty>
      ) : (
        <div className="card divide-y divide-border">
          {data.data.map((key) => (
            <div key={key.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[14px]">sk_…{key.last4}</p>
                <p className="text-[12px] text-text-faint">
                  {en ? 'Created ' : 'Creada el '}
                  {formatDate(key.created_at, en)}
                </p>
              </div>
              <ConfirmAction
                label={en ? 'Revoke' : 'Revocar'}
                confirmLabel={en ? 'Yes, revoke' : 'Sí, revocar'}
                busy={busy}
                english={en}
                onConfirm={() => run(() => flow(`api_keys/${key.id}`, { method: 'DELETE' }))}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function Webhooks() {
  const { english: en } = useConsole();
  const flow = useFlowAction();
  const { revision, busy, error: actionError, run } = useChange();
  const { data, error } = useFlow<{ data: { id: string; url: string; created_at: number }[] }>(
    'webhook_endpoints',
    revision,
  );
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        title="Webhooks"
        description={
          <>
            {en
              ? 'GatoPago sends every event to your URLs, signed in the '
              : 'GatoPago envía cada evento a tus URLs, firmado en el encabezado '}
            <code className="font-mono">GatoPago-Signature</code>
            {en
              ? ' header (HMAC-SHA256 with the endpoint secret). Failed deliveries are retried up to 10 times.'
              : ' (HMAC-SHA256 con el secreto del endpoint). Si una entrega falla, se reintenta hasta 10 veces.'}
          </>
        }
      />
      {secret ? <OneTimeSecret value={secret} english={en} /> : null}
      <form
        className="mb-6 flex flex-col gap-2 md:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          run(() =>
            flow<{ secret: string }>('webhook_endpoints', { body: { url } }).then((endpoint) => {
              setSecret(endpoint.secret);
              setUrl('');
            }),
          );
        }}
      >
        <input
          type="url"
          required
          inputMode="url"
          placeholder={
            en
              ? 'https://your-server.com/webhooks/gatopago'
              : 'https://tu-servidor.com/webhooks/gatopago'
          }
          aria-label={en ? 'Endpoint URL' : 'URL del endpoint'}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="field min-w-0 flex-1"
        />
        <button type="submit" disabled={busy || !url} className="btn btn-primary shrink-0">
          {en ? 'Add endpoint' : 'Agregar endpoint'}
        </button>
      </form>
      {actionError ? <Failure>{actionError}</Failure> : null}
      {error ? (
        <Failure>{error}</Failure>
      ) : !data ? (
        <RowsLoading count={2} />
      ) : data.data.length === 0 ? (
        <Empty>
          {en
            ? 'No endpoints yet. Add the URL where your server listens.'
            : 'Todavía no hay endpoints. Agrega la URL donde escucha tu servidor.'}
        </Empty>
      ) : (
        <div className="card divide-y divide-border">
          {data.data.map((endpoint) => (
            <div key={endpoint.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[13px]">{endpoint.url}</p>
                <p className="text-[12px] text-text-faint">{formatDate(endpoint.created_at, en)}</p>
              </div>
              <ConfirmAction
                label={en ? 'Remove' : 'Eliminar'}
                confirmLabel={en ? 'Yes, remove' : 'Sí, eliminar'}
                busy={busy}
                english={en}
                onConfirm={() =>
                  run(() => flow(`webhook_endpoints/${endpoint.id}`, { method: 'DELETE' }))
                }
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

type Delivery = { attempts: number; delivered_at: number | null; last_status: number | null };

function deliveryLabel(deliveries: Delivery[], en: boolean): [string, string] {
  if (deliveries.length === 0) return [en ? 'No endpoints' : 'Sin endpoints', 'text-text-faint'];
  if (deliveries.every((delivery) => delivery.delivered_at))
    return [en ? 'Delivered' : 'Entregado', 'text-growth'];
  if (deliveries.some((delivery) => delivery.attempts >= 10))
    return [en ? 'Failed' : 'Falló', 'text-danger'];
  const attempts = Math.max(...deliveries.map((delivery) => delivery.attempts));
  return attempts === 0
    ? [en ? 'Sending' : 'Enviando', 'text-info']
    : [en ? `Retrying (${attempts})` : `Reintentando (${attempts})`, 'text-pending'];
}

export function Events() {
  const { english: en } = useConsole();
  const flow = useFlowAction();
  const { revision, busy, error: actionError, run } = useChange();
  const { data, error } = useFlow<{
    data: { id: string; type: string; created_at: number; data: unknown; deliveries: Delivery[] }[];
  }>('events', revision);
  return (
    <>
      <PageHeader
        title={en ? 'Events' : 'Eventos'}
        description={
          en
            ? 'The latest 100 events of your business and how each delivery went. Open one to see what was sent.'
            : 'Los últimos 100 eventos de tu negocio y cómo fue cada entrega. Abre uno para ver lo que se envió.'
        }
      />
      {actionError ? <Failure>{actionError}</Failure> : null}
      {error ? (
        <Failure>{error}</Failure>
      ) : !data ? (
        <RowsLoading count={6} />
      ) : data.data.length === 0 ? (
        <Empty>{en ? 'No events yet.' : 'Todavía no hay eventos.'}</Empty>
      ) : (
        <div className="card divide-y divide-border">
          {data.data.map((event) => {
            const [label, tone] = deliveryLabel(event.deliveries, en);
            return (
              <details key={event.id} className="group px-4 py-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[13px]">{event.type}</span>
                    <span className="block text-[12px] text-text-faint">
                      {formatDate(event.created_at, en)}
                    </span>
                  </span>
                  <span className={`shrink-0 text-[12px] font-semibold ${tone}`}>{label}</span>
                  <span
                    aria-hidden="true"
                    className="text-text-faint transition-transform group-open:rotate-90"
                  >
                    ›
                  </span>
                </summary>
                <pre className="mt-3 max-h-72 overflow-auto border border-border bg-surface-2 p-3 font-mono text-[12px] leading-relaxed">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
                {event.deliveries.length > 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-ghost btn-sm mt-3"
                    onClick={() => run(() => flow(`events/${event.id}/resend`, { body: {} }))}
                  >
                    {busy ? (en ? 'Resending…' : 'Reenviando…') : en ? 'Resend' : 'Reenviar'}
                  </button>
                ) : null}
              </details>
            );
          })}
        </div>
      )}
    </>
  );
}
