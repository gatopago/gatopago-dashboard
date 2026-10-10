'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useLocale, useTranslations } from 'next-intl';
import { useFailureMessage } from '../lib/failure';
import { safeNext } from '../lib/next';
import { currentSession, subscribeSession } from '../lib/session';
import type { ClientSettings } from '../lib/settings';
import { collectLogin, requestLogin, type LoginRequest } from '../lib/signIn';
import type { Hex } from 'viem';
import { Brand, Meli } from './Brand';
import { LanguageSwitch } from './LanguageSwitch';

/** A QR renews itself this many times while the page is open, then waits for a tap. */
const RENEWALS = 5;
const POLL_MS = 2000;

export function Login({ settings }: { settings: ClientSettings }) {
  const router = useRouter();
  const t = useTranslations('Login');
  const locale = useLocale();
  const messageFor = useFailureMessage();
  const next = safeNext(useSearchParams().get('next'));
  const session = useSyncExternalStore(subscribeSession, currentSession, () => undefined);
  const [request, setRequest] = useState<LoginRequest | null>(null);
  const [state, setState] = useState<'loading' | 'waiting' | 'expired' | 'approved'>('loading');
  const [renewals, setRenewals] = useState(0);
  const [failure, setFailure] = useState<unknown>(null);
  const error = failure ? messageFor(failure) : '';
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  /** This passkey's Business key, waiting for the app to approve it with the QR (once per passkey). */
  const [unapproved, setUnapproved] = useState<Hex | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (session) router.replace(next);
  }, [session, router, next]);

  // Asks Wallet Core for a new QR; callers show the loading state first.
  const renew = useCallback(() => {
    requestLogin(settings, unapproved ?? undefined)
      .then((value) => {
        setRequest(value);
        setState('waiting');
      })
      .catch((failure: unknown) => {
        setFailure(failure);
        setState('expired');
      });
  }, [settings, unapproved]);

  useEffect(renew, [renew]);

  // The signing code (passkey and Mera) loads after the QR shows: the passkey prompt still opens
  // right on the tap.
  useEffect(() => {
    void import('../lib/signInHere');
  }, []);

  // Waits for the app's approval; an expired QR renews itself a few times.
  useEffect(() => {
    if (!request || state !== 'waiting') return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await collectLogin(settings, request, controller.signal);
        if (result === 'expired') {
          if (renewals < RENEWALS && document.visibilityState === 'visible') {
            setRenewals((value) => value + 1);
            setState('loading');
            renew();
          } else setState('expired');
          return;
        }
        if (result !== 'pending') {
          setState('approved');
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      timer = setTimeout(() => void poll(), POLL_MS);
    };
    timer = setTimeout(() => void poll(), POLL_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [request, state, settings, renewals, renew]);

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  const seconds = request ? Math.max(0, request.expires_at - Math.floor(now / 1000)) : 0;
  const steps = [t('step1'), t('step2'), t('step3')];

  /** Signing in on this device with any GatoPago passkey: the account's kind is found, not asked. */
  const signInHere = () => {
    setPasskeyBusy(true);
    setFailure(null);
    import('../lib/signInHere')
      .then((signIn) =>
        signIn.signInHere(settings).catch((failure: unknown) => {
          // First time with this passkey: the next QR carries its key for the app to approve.
          if (failure instanceof signIn.UnapprovedKey) {
            setRenewals(0);
            setState('loading');
            setUnapproved(failure.publicKey);
          } else setFailure(failure);
        }),
      )
      .finally(() => setPasskeyBusy(false));
  };
  const passkey = (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="btn btn-ghost btn-block"
        disabled={passkeyBusy}
        onClick={signInHere}
      >
        {passkeyBusy ? t('confirmOnDevice') : t('useKeyHere')}
      </button>
    </div>
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-[980px] flex-col px-5 py-6 md:px-10">
      <header className="flex items-center justify-between">
        <Brand />
        <LanguageSwitch className="btn-text text-[13px]" />
      </header>
      <div className="grid flex-1 items-center gap-10 py-10 md:grid-cols-[1fr_360px] md:gap-16">
        <section className="animate-fade-up">
          <p className="kicker mb-4">{t('kicker')}</p>
          <h1 className="text-[34px] md:text-[44px]">{t('title')}</h1>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-text-muted">
            {t('copy')}
          </p>
          <ol className="mt-8 hidden flex-col gap-3 md:flex">
            {steps.map((step, index) => (
              <li key={step} className="flex items-center gap-3 text-[15px]">
                <span className="grid h-7 w-7 shrink-0 place-items-center border-2 border-text bg-cat-500 font-display text-[13px] text-on-cat">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-8 hidden max-w-[320px] md:block">{passkey}</div>
        </section>

        <section className="card-strong flex flex-col items-center p-6 text-center animate-fade-up">
          {state === 'approved' ? (
            <div role="status" className="py-10">
              <Meli variant="head-happy" className="mx-auto mb-4 w-20" />
              <p className="font-display text-[20px]">{t('approved')}</p>
              <p className="mt-1 text-[14px] text-text-muted">{t('signingIn')}</p>
            </div>
          ) : state === 'expired' ? (
            <div className="py-8">
              <Meli variant="head-cautious" className="mx-auto mb-4 w-20" />
              <p className="font-display text-[18px]">{error || t('codeExpired')}</p>
              <button
                type="button"
                className="btn btn-primary mt-5"
                onClick={() => {
                  setRenewals(0);
                  setFailure(null);
                  setState('loading');
                  renew();
                }}
              >
                {t('newCode')}
              </button>
            </div>
          ) : (
            <>
              {unapproved ? (
                <p role="status" className="mb-4 max-w-[30ch] text-[14px] text-text-muted">
                  {t('firstTimeKey')}
                </p>
              ) : (
                <p className="mb-4 text-[14px] text-text-muted md:hidden">{t('scanWithApp')}</p>
              )}
              <div className="border-2 border-text bg-white p-3 shadow-[6px_6px_0_var(--color-cat-700)]">
                {request && state === 'waiting' ? (
                  <QRCodeSVG
                    value={request.approve_url}
                    size={232}
                    bgColor="#ffffff"
                    fgColor="#0A0A0B"
                    level="M"
                    aria-label={t('codeLabel')}
                  />
                ) : (
                  <div className="skeleton h-[232px] w-[232px]" aria-busy="true" />
                )}
              </div>
              <p className="mt-5 text-[13px] text-text-faint" aria-live="off">
                {state === 'waiting' ? t('waiting', { seconds }) : t('preparing')}
              </p>
            </>
          )}
        </section>
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {error && state !== 'expired' ? (
          <p role="alert" className="text-center text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        {passkey}
      </div>
      {error && state !== 'expired' ? (
        <p role="alert" className="hidden text-[13px] text-danger md:block">
          {error}
        </p>
      ) : null}
      <footer className="mt-8 text-center text-[13px] text-text-muted">
        {t('noAccount')}{' '}
        <a
          href={`${settings.webOrigin}${locale === 'en' ? '/en' : ''}/login`}
          className="font-semibold text-text underline"
        >
          {t('createInApp')}
        </a>
      </footer>
    </main>
  );
}
