'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useFailureMessage } from '../lib/failure';
import { formatDate } from '../lib/format';
import { useFlow, useFlowAction } from './Console';
import {
  ConfirmAction,
  Empty,
  Failure,
  OneTimeSecret,
  PageHeader,
  RowsLoading,
} from './Primitives';

/** Runs a change through Flow, then reads the list again; a second tap while it runs does nothing. */
function useChange() {
  const messageFor = useFailureMessage();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const running = useRef(false);
  const run = (action: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    action()
      .then(() => setRevision((value) => value + 1))
      .catch((failure: unknown) => setError(messageFor(failure)))
      .finally(() => {
        running.current = false;
        setBusy(false);
      });
  };
  return { revision, busy, error, run };
}

export function ApiKeys() {
  const t = useTranslations('Keys');
  const locale = useLocale();
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
        title={t('title')}
        description={t('description')}
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
            {t('create')}
          </button>
        }
      />
      {created ? <OneTimeSecret value={created} /> : null}
      {actionError ? <Failure>{actionError}</Failure> : null}
      {error ? (
        <Failure>{error}</Failure>
      ) : !data ? (
        <RowsLoading count={2} />
      ) : data.data.length === 0 ? (
        <Empty>{t('empty')}</Empty>
      ) : (
        <div className="card divide-y divide-border">
          {data.data.map((key) => (
            <div key={key.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[14px]">sk_…{key.last4}</p>
                <p className="text-[12px] text-text-faint">
                  {t('created', { date: formatDate(key.created_at, locale) })}
                </p>
              </div>
              <ConfirmAction
                label={t('revoke')}
                confirmLabel={t('confirmRevoke')}
                busy={busy}
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
  const t = useTranslations('Webhooks');
  const locale = useLocale();
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
        title={t('title')}
        description={t.rich('description', {
          code: (chunks: ReactNode) => <code className="font-mono">{chunks}</code>,
        })}
      />
      {secret ? <OneTimeSecret value={secret} /> : null}
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
          placeholder={t('placeholder')}
          aria-label={t('urlLabel')}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="field min-w-0 flex-1"
        />
        <button type="submit" disabled={busy || !url} className="btn btn-primary shrink-0">
          {t('add')}
        </button>
      </form>
      {actionError ? <Failure>{actionError}</Failure> : null}
      {error ? (
        <Failure>{error}</Failure>
      ) : !data ? (
        <RowsLoading count={2} />
      ) : data.data.length === 0 ? (
        <Empty>{t('empty')}</Empty>
      ) : (
        <div className="card divide-y divide-border">
          {data.data.map((endpoint) => (
            <div key={endpoint.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[13px]">{endpoint.url}</p>
                <p className="text-[12px] text-text-faint">
                  {formatDate(endpoint.created_at, locale)}
                </p>
              </div>
              <ConfirmAction
                label={t('remove')}
                confirmLabel={t('confirmRemove')}
                busy={busy}
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

/** How an event's deliveries went: its text in `Events`, and its color. */
function deliveryStatus(deliveries: Delivery[]) {
  if (deliveries.length === 0) return { label: 'noEndpoints', tone: 'text-text-faint' } as const;
  if (deliveries.every((delivery) => delivery.delivered_at))
    return { label: 'delivered', tone: 'text-growth' } as const;
  if (deliveries.some((delivery) => delivery.attempts >= 10))
    return { label: 'failed', tone: 'text-danger' } as const;
  const attempts = Math.max(...deliveries.map((delivery) => delivery.attempts));
  return attempts === 0
    ? ({ label: 'sending', tone: 'text-info' } as const)
    : ({ label: 'retrying', tone: 'text-pending', attempts } as const);
}

export function Events() {
  const t = useTranslations('Events');
  const locale = useLocale();
  const flow = useFlowAction();
  const { revision, busy, error: actionError, run } = useChange();
  const { data, error } = useFlow<{
    data: { id: string; type: string; created_at: number; data: unknown; deliveries: Delivery[] }[];
  }>('events', revision);
  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      {actionError ? <Failure>{actionError}</Failure> : null}
      {error ? (
        <Failure>{error}</Failure>
      ) : !data ? (
        <RowsLoading count={6} />
      ) : data.data.length === 0 ? (
        <Empty>{t('empty')}</Empty>
      ) : (
        <div className="card divide-y divide-border">
          {data.data.map((event) => {
            const status = deliveryStatus(event.deliveries);
            return (
              <details key={event.id} className="group px-4 py-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[13px]">{event.type}</span>
                    <span className="block text-[12px] text-text-faint">
                      {formatDate(event.created_at, locale)}
                    </span>
                  </span>
                  <span className={`shrink-0 text-[12px] font-semibold ${status.tone}`}>
                    {status.label === 'retrying'
                      ? t('retrying', { attempts: status.attempts })
                      : t(status.label)}
                  </span>
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
                    {busy ? t('resending') : t('resend')}
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
