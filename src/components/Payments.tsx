'use client';

import { useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { walletNetwork } from '@gatopago/shared/networks';
import { failureMessage } from '../lib/api';
import {
  explorerUrl,
  formatAmount,
  formatDate,
  networkName,
  statusLabel,
  type Intent,
} from '../lib/format';
import { useConsole, useFlow, useFlowAction } from './Console';
import {
  ConfirmAction,
  CopyButton,
  Empty,
  Failure,
  PageHeader,
  Row,
  RowsLoading,
  Status,
} from './Primitives';

const STATUSES = ['succeeded', 'requires_payment', 'processing', 'expired', 'canceled'] as const;

export function Payments() {
  const { english: en } = useConsole();
  const { data, error } = useFlow<{ data: Intent[] }>('payment_intents');
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const intents = (data?.data ?? []).filter(
    (intent) =>
      (status === 'all' || intent.status === status) &&
      (!query ||
        intent.id.includes(query) ||
        (intent.description ?? '').toLowerCase().includes(query)),
  );
  return (
    <>
      <PageHeader
        title={en ? 'Payments' : 'Cobros'}
        description={
          en
            ? 'The charges your server created, newest first.'
            : 'Los cobros que creó tu servidor, del más reciente al más antiguo.'
        }
      />
      <div className="mb-5 flex flex-col gap-2.5 md:flex-row">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={
            en ? 'Search by id (pi_…) or description' : 'Buscar por id (pi_…) o descripción'
          }
          aria-label={en ? 'Search by id or description' : 'Buscar por id o descripción'}
          autoComplete="off"
          spellCheck={false}
          className="field md:max-w-[360px]"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label={en ? 'Filter by status' : 'Filtrar por estado'}
          className="field md:w-56"
        >
          <option value="all">{en ? 'All statuses' : 'Todos los estados'}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {statusLabel(value, en)[0]}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <Failure>{error}</Failure>
      ) : !data ? (
        <RowsLoading count={6} />
      ) : intents.length === 0 ? (
        <Empty>
          {query || status !== 'all'
            ? en
              ? 'No charge matches the filters.'
              : 'Ningún cobro coincide con los filtros.'
            : en
              ? 'No charges yet. Create the first one from your server.'
              : 'Todavía no hay cobros. Crea el primero desde tu servidor.'}
        </Empty>
      ) : (
        <div className="card divide-y divide-border">
          {intents.map((intent) => (
            <Link
              key={intent.id}
              href={`/payments/${intent.id}`}
              className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-cat-50"
            >
              <div className="min-w-0 flex-1">
                <p className="type-mono text-[15px] font-semibold">
                  {formatAmount(intent.amount, en)} USDC
                </p>
                <p className="truncate text-[12px] text-text-faint">
                  {formatDate(intent.created_at, en)}
                  {intent.description ? ` · ${intent.description}` : ''}
                </p>
              </div>
              <span className="hidden font-mono text-[12px] text-text-faint md:block">
                {intent.id}
              </span>
              <Status status={intent.status} english={en} />
            </Link>
          ))}
        </div>
      )}
      {data && data.data.length >= 100 ? (
        <p className="mt-3 text-center text-[12px] text-text-faint">
          {en ? 'Showing the latest 100 charges.' : 'Se muestran los últimos 100 cobros.'}
        </p>
      ) : null}
    </>
  );
}

export function PaymentDetail({ id }: { id: string }) {
  const { settings, english: en } = useConsole();
  const flow = useFlowAction();
  const [revision, setRevision] = useState(0);
  const { data: intent, error } = useFlow<Intent>(`payment_intents/${id}`, revision);
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState('');
  const testnet = walletNetwork(settings.homeNetwork).chain.testnet;
  const act = (action: 'cancel' | 'simulate') => {
    setBusy(true);
    setActionError('');
    flow(`payment_intents/${id}/${action}`, { body: {} })
      .then(() => setRevision((value) => value + 1))
      .catch((failure: unknown) => setActionError(failureMessage(failure, en)))
      .finally(() => setBusy(false));
  };
  const back = (
    <Link href="/payments" className="btn-text -ml-3 mb-2 text-[13px]">
      ← {en ? 'All payments' : 'Todos los cobros'}
    </Link>
  );
  if (error)
    return (
      <>
        {back}
        <Failure>{error}</Failure>
      </>
    );
  if (!intent)
    return (
      <>
        {back}
        <RowsLoading count={3} />
      </>
    );
  const payment = intent.payment;
  const receipt =
    payment?.transaction_hash && explorerUrl(payment.network, payment.transaction_hash);
  return (
    <>
      {back}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="card-strong p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h1 className="type-mono text-[30px] font-bold">
              {formatAmount(intent.amount, en)} USDC
            </h1>
            <Status status={intent.status} english={en} />
          </div>
          <Row label="ID">
            <span className="inline-flex items-center gap-2">
              <code className="font-mono">{intent.id}</code>
              <CopyButton
                value={intent.id}
                english={en}
                className="btn-text !min-h-8 !p-1 text-[12px] text-info"
              />
            </span>
          </Row>
          {intent.description ? (
            <Row label={en ? 'Description' : 'Descripción'}>{intent.description}</Row>
          ) : null}
          <Row label={en ? 'Created' : 'Creado'}>{formatDate(intent.created_at, en)}</Row>
          {intent.status === 'requires_payment' ? (
            <Row label={en ? 'Expires' : 'Vence'}>{formatDate(intent.expires_at, en)}</Row>
          ) : null}
          {payment ? (
            <>
              <Row label={en ? 'Paid on' : 'Pagado en'}>{networkName(payment.network)}</Row>
              {payment.paid_at ? (
                <Row label={en ? 'Paid at' : 'Fecha de pago'}>
                  {formatDate(payment.paid_at, en)}
                </Row>
              ) : null}
              {payment.payer ? (
                <Row label={en ? 'Payer' : 'Pagador'}>
                  <code className="font-mono">{payment.payer}</code>
                </Row>
              ) : null}
              {receipt ? (
                <Row label={en ? 'Transaction' : 'Transacción'}>
                  <a
                    href={receipt}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info underline"
                  >
                    {en ? 'See it on the blockchain ↗' : 'Verla en la blockchain ↗'}
                  </a>
                </Row>
              ) : null}
            </>
          ) : null}
        </section>

        {intent.status === 'requires_payment' ? (
          <aside className="flex flex-col gap-4">
            <section className="card p-5 text-center">
              <h2 className="mb-1 text-[17px]">
                {en ? 'Get paid in person' : 'Cobrar en persona'}
              </h2>
              <p className="mb-4 text-[13px] text-text-muted">
                {en
                  ? 'Show this QR to your customer or share the link.'
                  : 'Muestra este QR a tu cliente o comparte el link.'}
              </p>
              <div className="mx-auto mb-4 w-fit border-2 border-text bg-white p-3 shadow-[6px_6px_0_var(--color-cat-700)]">
                <QRCodeSVG
                  value={intent.checkout_url}
                  size={176}
                  bgColor="#ffffff"
                  fgColor="#0A0A0B"
                  level="M"
                />
              </div>
              <div className="flex gap-2.5">
                <a
                  href={intent.checkout_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm flex-1"
                >
                  {en ? 'Open payment page' : 'Abrir página de pago'}
                </a>
                <CopyButton
                  value={intent.checkout_url}
                  label={en ? 'Copy link' : 'Copiar link'}
                  english={en}
                  className="btn btn-ghost btn-sm flex-1"
                />
              </div>
            </section>
            {actionError ? <Failure>{actionError}</Failure> : null}
            {testnet ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => act('simulate')}
                className="btn btn-ghost btn-block"
              >
                {en ? 'Mark as paid (test)' : 'Marcar como pagado (prueba)'}
              </button>
            ) : null}
            <div className="flex justify-center">
              <ConfirmAction
                label={en ? 'Cancel this charge' : 'Cancelar este cobro'}
                confirmLabel={en ? 'Yes, cancel it' : 'Sí, cancelarlo'}
                busy={busy}
                english={en}
                onConfirm={() => act('cancel')}
              />
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );
}
