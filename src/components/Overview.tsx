'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useFailureMessage } from '../lib/failure';
import { networkName, shortAddress } from '../lib/format';
import { useConsole, useFlow, useFlowAction } from './Console';
import { CopyButton, PageHeader } from './Primitives';

/** How many charges Flow lists at most (`GET /v1/payment_intents`). */
const FLOW_PAGE = 100;

export function Overview() {
  const { settings } = useConsole();
  const t = useTranslations('Overview');
  const locale = useLocale();
  const messageFor = useFailureMessage();
  const flow = useFlowAction();
  const merchant = useFlow<{ id: string; name: string | null; address: string }>('merchant');
  const keys = useFlow<{ data: unknown[] }>('api_keys');
  const hooks = useFlow<{ data: unknown[] }>('webhook_endpoints');
  const charges = useFlow<{ data: { status: string }[] }>('payment_intents');
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false),
    [notice, setNotice] = useState('');
  const shownName = name ?? merchant.data?.name ?? '';
  const curl = `curl -X POST ${settings.apiOrigin}/v1/payment_intents \\
  -H "Authorization: Bearer sk_test_…" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-A-1042" \\
  -d '{"amount":"25.00","description":"Order A-1042"}'`;
  // Flow lists the latest 100 charges: when it returns that many, older paid ones may exist.
  const latest = charges.data?.data;
  const paidCount = latest?.filter((intent) => intent.status === 'succeeded').length;
  const paid = latest?.length === FLOW_PAGE ? `${paidCount}+` : paidCount;
  const stats: [string, number | string | undefined, string][] = [
    [t('paidCharges'), paid, '/payments'],
    [t('keys'), keys.data?.data.length, '/keys'],
    [t('webhooks'), hooks.data?.data.length, '/webhooks'],
  ];
  const code = (chunks: ReactNode) => <code className="font-mono">{chunks}</code>;
  const link = (href: string) => (chunks: ReactNode) => (
    <Link href={href} className="-my-3 inline-block py-3 text-info underline">
      {chunks}
    </Link>
  );

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />

      <div className="mb-6 grid grid-cols-3 gap-3">
        {stats.map(([label, value, href]) => (
          <Link key={href} href={href} className="card p-4 transition-colors hover:bg-cat-50">
            <p className="type-mono text-[26px] font-bold leading-none md:text-[30px]">
              {value ?? '—'}
            </p>
            <p className="mt-2 text-[12px] text-text-muted md:text-[13px]">{label}</p>
          </Link>
        ))}
      </div>

      {/* One column on phones, never wider than the screen (a code sample cannot stretch it). */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <form
          className="card-strong p-5"
          onSubmit={(event) => {
            event.preventDefault();
            setSaving(true);
            setNotice('');
            flow('merchant', { body: { name: shownName } })
              .then(() => setNotice(t('saved')))
              .catch((failure: unknown) => setNotice(messageFor(failure)))
              .finally(() => setSaving(false));
          }}
        >
          <h2 className="mb-1 text-[18px]">{t('business')}</h2>
          <label htmlFor="merchant-name" className="mb-1.5 block text-[13px] text-text-muted">
            {t('nameLabel')}
          </label>
          <input
            id="merchant-name"
            required
            maxLength={60}
            value={shownName}
            onChange={(event) => setName(event.target.value)}
            className="field mb-3"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !shownName.trim()}
              className="btn btn-primary btn-sm"
            >
              {saving ? t('saving') : t('save')}
            </button>
            {notice ? (
              <span role="status" className="text-[13px] text-text-muted">
                {notice}
              </span>
            ) : null}
          </div>
          {merchant.data ? (
            <p className="mt-5 border-t border-border pt-4 text-[13px] leading-relaxed text-text-muted">
              {t.rich('arrives', {
                network: networkName(settings.homeNetwork),
                address: shortAddress(merchant.data.address),
                code,
              })}
            </p>
          ) : null}
        </form>

        <section className="card p-5">
          <h2 className="mb-4 text-[18px]">{t('integrate')}</h2>
          <ol className="flex flex-col gap-4">
            <Step index={1} title={t('keyTitle')}>
              {t.rich('keyBody', { link: link('/keys') })}
            </Step>
            <Step index={2} title={t('chargeTitle')}>
              <div className="relative my-2">
                <pre className="overflow-x-auto border border-border bg-surface-2 p-3 pr-20 font-mono text-[11px] leading-relaxed">
                  {curl}
                </pre>
                <CopyButton
                  value={curl}
                  className="btn btn-ghost btn-sm absolute top-2 right-2 !min-h-8 !px-2.5 text-[12px]"
                />
              </div>
              {t.rich('chargeBody', { code })}
            </Step>
            <Step index={3} title={t('webhookTitle')}>
              {t.rich('webhookBody', { link: link('/webhooks'), code })}
            </Step>
          </ol>
          <p className="mt-5 text-[13px] text-text-muted">
            {t.rich('reference', {
              link: (chunks) => (
                <a
                  href={`${settings.webOrigin}${locale === 'en' ? '/en' : ''}/docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="-my-3 inline-block py-3 text-info underline"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </section>
      </div>
    </>
  );
}

function Step({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center border-2 border-text bg-cat-500 font-display text-[13px] text-on-cat">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px]">{title}</p>
        <div className="text-[13px] leading-relaxed text-text-muted">{children}</div>
      </div>
    </li>
  );
}
