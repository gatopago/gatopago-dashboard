'use client';

import { useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { walletNetwork } from '@gatopago/shared/networks';
import { useLocale, useTranslations } from 'next-intl';
import { useFailureMessage } from '../lib/failure';
import { explorerUrl, formatAmount, formatDate, networkName, type Intent } from '../lib/format';
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
  const t = useTranslations('Payments');
  const statusName = useTranslations('Status');
  const locale = useLocale();
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
      <PageHeader title={t('title')} description={t('description')} />
      <div className="mb-5 flex flex-col gap-2.5 md:flex-row">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchLabel')}
          autoComplete="off"
          spellCheck={false}
          className="field md:max-w-[360px]"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label={t('filterLabel')}
          className="field md:w-56"
        >
          <option value="all">{t('allStatuses')}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {statusName(value)}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <Failure>{error}</Failure>
      ) : !data ? (
        <RowsLoading count={6} />
      ) : intents.length === 0 ? (
        <Empty>{query || status !== 'all' ? t('noMatch') : t('empty')}</Empty>
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
                  {formatAmount(intent.amount, locale)} USDC
                </p>
                <p className="truncate text-[12px] text-text-faint">
                  {formatDate(intent.created_at, locale)}
                  {intent.description ? ` · ${intent.description}` : ''}
                </p>
              </div>
              <span className="hidden min-w-0 shrink truncate font-mono text-[12px] text-text-faint lg:block">
                {intent.id}
              </span>
              <Status status={intent.status} />
            </Link>
          ))}
        </div>
      )}
      {data && data.data.length >= 100 ? (
        <p className="mt-3 text-center text-[12px] text-text-faint">{t('latest')}</p>
      ) : null}
    </>
  );
}

export function PaymentDetail({ id }: { id: string }) {
  const { settings } = useConsole();
  const t = useTranslations('Payments');
  const locale = useLocale();
  const messageFor = useFailureMessage();
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
      .catch((failure: unknown) => setActionError(messageFor(failure)))
      .finally(() => setBusy(false));
  };
  const back = (
    <Link href="/payments" className="btn-text -ml-3 mb-2 text-[13px]">
      ← {t('all')}
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
              {formatAmount(intent.amount, locale)} USDC
            </h1>
            <Status status={intent.status} />
          </div>
          <Row label="ID">
            <span className="inline-flex items-center gap-2">
              <code className="min-w-0 break-all font-mono">{intent.id}</code>
              <CopyButton
                value={intent.id}
                className="btn-text !min-h-8 !p-1 text-[12px] text-info"
              />
            </span>
          </Row>
          {intent.description ? (
            <Row label={t('descriptionLabel')}>{intent.description}</Row>
          ) : null}
          <Row label={t('created')}>{formatDate(intent.created_at, locale)}</Row>
          {intent.status === 'requires_payment' ? (
            <Row label={t('expires')}>{formatDate(intent.expires_at, locale)}</Row>
          ) : null}
          {payment ? (
            <>
              <Row label={t('paidOn')}>{networkName(payment.network)}</Row>
              {payment.paid_at ? (
                <Row label={t('paidAt')}>{formatDate(payment.paid_at, locale)}</Row>
              ) : null}
              {payment.payer ? (
                <Row label={t('payer')}>
                  <code className="font-mono">{payment.payer}</code>
                </Row>
              ) : null}
              {receipt ? (
                <Row label={t('transaction')}>
                  <a
                    href={receipt}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="-my-3 inline-block py-3 text-info underline"
                  >
                    {t('onChain')}
                  </a>
                </Row>
              ) : null}
            </>
          ) : null}
        </section>

        {intent.status === 'requires_payment' ? (
          <aside className="flex flex-col gap-4">
            <section className="card p-5 text-center">
              <h2 className="mb-1 text-[17px]">{t('inPerson')}</h2>
              <p className="mb-4 text-[13px] text-text-muted">{t('inPersonCopy')}</p>
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
                  {t('openPage')}
                </a>
                <CopyButton
                  value={intent.checkout_url}
                  label={t('copyLink')}
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
                {t('markPaid')}
              </button>
            ) : null}
            <div className="flex justify-center">
              <ConfirmAction
                label={t('cancelCharge')}
                confirmLabel={t('confirmCancel')}
                busy={busy}
                onConfirm={() => act('cancel')}
              />
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );
}
