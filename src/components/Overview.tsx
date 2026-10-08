'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { failureMessage } from '../lib/api';
import { networkName, shortAddress } from '../lib/format';
import { useConsole, useFlow, useFlowAction } from './Console';
import { CopyButton, PageHeader } from './Primitives';

/** How many charges Flow lists at most (`GET /v1/payment_intents`). */
const FLOW_PAGE = 100;

export function Overview() {
  const { settings, english: en } = useConsole();
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
    [en ? 'Paid charges' : 'Cobros pagados', paid, '/payments'],
    [en ? 'API keys' : 'Claves API', keys.data?.data.length, '/keys'],
    ['Webhooks', hooks.data?.data.length, '/webhooks'],
  ];

  return (
    <>
      <PageHeader
        title={en ? 'Overview' : 'Resumen'}
        description={
          en
            ? 'Get paid in USDC from any wallet or GatoPago account. The money arrives straight in your account.'
            : 'Cobra en USDC desde cualquier wallet o cuenta GatoPago. El dinero llega directo a tu cuenta.'
        }
      />

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

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="card-strong p-5"
          onSubmit={(event) => {
            event.preventDefault();
            setSaving(true);
            setNotice('');
            flow('merchant', { body: { name: shownName } })
              .then(() => setNotice(en ? 'Saved ✓' : 'Guardado ✓'))
              .catch((failure: unknown) => setNotice(failureMessage(failure, en)))
              .finally(() => setSaving(false));
          }}
        >
          <h2 className="mb-1 text-[18px]">{en ? 'Your business' : 'Tu negocio'}</h2>
          <label htmlFor="merchant-name" className="mb-1.5 block text-[13px] text-text-muted">
            {en ? 'Name your customers see when paying' : 'Nombre que ven tus clientes al pagar'}
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
              {saving ? (en ? 'Saving…' : 'Guardando…') : en ? 'Save' : 'Guardar'}
            </button>
            {notice ? (
              <span role="status" className="text-[13px] text-text-muted">
                {notice}
              </span>
            ) : null}
          </div>
          {merchant.data ? (
            <p className="mt-5 border-t border-border pt-4 text-[13px] leading-relaxed text-text-muted">
              {en
                ? `Payments arrive at your GatoPago account on ${networkName(settings.homeNetwork)} (`
                : `Los cobros llegan a tu cuenta GatoPago en ${networkName(settings.homeNetwork)} (`}
              <code className="font-mono">{shortAddress(merchant.data.address)}</code>
              {en
                ? '). No custody: the money is yours from the first second.'
                : '). Sin custodia: el dinero es tuyo desde el primer segundo.'}
            </p>
          ) : null}
        </form>

        <section className="card p-5">
          <h2 className="mb-4 text-[18px]">
            {en ? 'Integrate in three steps' : 'Intégralo en tres pasos'}
          </h2>
          <ol className="flex flex-col gap-4">
            <Step index={1} title={en ? 'Create an API key' : 'Crea una clave API'}>
              {en ? 'In ' : 'En '}
              <Link href="/keys" className="text-info underline">
                {en ? 'API keys' : 'Claves API'}
              </Link>
              .
            </Step>
            <Step
              index={2}
              title={en ? 'Create a charge from your server' : 'Crea un cobro desde tu servidor'}
            >
              <div className="relative my-2">
                <pre className="overflow-x-auto border border-border bg-surface-2 p-3 pr-20 font-mono text-[11px] leading-relaxed">
                  {curl}
                </pre>
                <CopyButton
                  value={curl}
                  english={en}
                  className="btn btn-ghost btn-sm absolute top-2 right-2 !min-h-8 !px-2.5 text-[12px]"
                />
              </div>
              {en ? 'It returns a ' : 'Te devuelve un '}
              <code className="font-mono">checkout_url</code>
              {en ? ': the link or QR your customer pays.' : ': el link o QR que paga tu cliente.'}
            </Step>
            <Step index={3} title={en ? 'Receive the webhook' : 'Recibe el webhook'}>
              {en ? 'Register your URL in ' : 'Registra tu URL en '}
              <Link href="/webhooks" className="text-info underline">
                Webhooks
              </Link>
              {en ? '. When it is paid, a signed ' : '. Cuando se paga, te llega '}
              <code className="font-mono">payment_intent.succeeded</code>
              {en ? ' arrives.' : ' firmado.'}
            </Step>
          </ol>
          <p className="mt-5 text-[13px] text-text-muted">
            {en ? 'Full reference: ' : 'Referencia completa: '}
            <a
              href={`${settings.webOrigin}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info underline"
            >
              {en ? 'documentation ↗' : 'documentación ↗'}
            </a>
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
